import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { isBlankRecord, parseStrictCsv, readUtf8Csv } from "./csv";
import { Phase2Error } from "./errors";
import {
  isCountryCode,
  isSuspiciousCpf,
  isSuspiciousPhone,
  normalizeHumanText,
  parseBirthDate,
  parseBoolean,
  parseMemberStatus,
  parseSide,
  trimToNull
} from "./normalize";
import { resolveSponsorRelations } from "./relations";
import {
  MEMBER_HEADERS,
  type CorrectionsManifest,
  type MemberField,
  type NormalizedMember,
  type SourceMemberRow,
  type ValidatedMemberRow,
  type ValidationDistributions,
  type ValidationIssue,
  type ValidationRun
} from "./types";

export interface ValidateMembersOptions {
  sourcePath: string;
  correctionsPath?: string;
}

export async function validateMembers(
  options: ValidateMembersOptions
): Promise<ValidationRun> {
  const source = await readUtf8Csv(options.sourcePath);
  const records = parseStrictCsv(source.text);
  const issues: ValidationIssue[] = [];

  if (records.length === 0) throw new Phase2Error("CSV_EMPTY");

  const header = records[0].values.map((value) => value.trim());
  validateHeader(header, issues);
  const structuralHeaderError = issues.some(
    (entry) => entry.severity === "error" && entry.code.startsWith("header_")
  );

  const rows = structuralHeaderError
    ? []
    : buildSourceRows(records.slice(1), header, issues);

  const correctionsManifest = options.correctionsPath
    ? await loadCorrectionsManifest(options.correctionsPath, issues)
    : null;
  const appliedCorrectionCount = applyCorrections(
    rows,
    correctionsManifest,
    source.sha256,
    issues
  );

  const validatedRows = rows.map((row) => validateRow(row, issues));
  validateDuplicateMemberNumbers(validatedRows, issues);
  const relationCounts = resolveSponsorRelations(validatedRows, issues);
  const distributions = buildDistributions(validatedRows);
  const nullCounts = buildNullCounts(validatedRows);

  return {
    sourceName: basename(options.sourcePath),
    sourceSha256: source.sha256,
    sourceByteLength: source.byteLength,
    hasUtf8Bom: source.hasUtf8Bom,
    header,
    rows: validatedRows,
    issues,
    appliedCorrectionCount,
    correctionsManifest,
    distributions,
    relationCounts,
    nullCounts
  };
}

function validateHeader(header: string[], issues: ValidationIssue[]): void {
  const seen = new Set<string>();
  for (const field of header) {
    if (seen.has(field)) issues.push(issue("error", "header_duplicate", 1, null));
    seen.add(field);
  }

  for (const required of MEMBER_HEADERS) {
    if (!seen.has(required)) issues.push(issue("error", "header_missing", 1, required));
  }

  for (const field of header) {
    if (!(MEMBER_HEADERS as readonly string[]).includes(field)) {
      issues.push(issue("error", "header_unknown", 1, null));
    }
  }
}

function buildSourceRows(
  records: ReturnType<typeof parseStrictCsv>,
  header: string[],
  issues: ValidationIssue[]
): SourceMemberRow[] {
  let lastDataIndex = records.length - 1;
  while (lastDataIndex >= 0 && isBlankRecord(records[lastDataIndex])) lastDataIndex -= 1;

  const rows: SourceMemberRow[] = [];
  for (let index = 0; index <= lastDataIndex; index += 1) {
    const record = records[index];
    if (isBlankRecord(record)) {
      issues.push(issue("warning", "blank_row", record.line, null));
      continue;
    }
    if (record.values.length !== header.length) {
      issues.push(issue("error", "column_count_mismatch", record.line, null));
    }

    const values = Object.fromEntries(
      MEMBER_HEADERS.map((field) => {
        const columnIndex = header.indexOf(field);
        return [field, columnIndex >= 0 ? record.values[columnIndex] ?? "" : ""];
      })
    ) as Record<MemberField, string>;
    rows.push({ sourceRow: record.line, values });
  }

  return rows;
}

async function loadCorrectionsManifest(
  path: string,
  issues: ValidationIssue[]
): Promise<CorrectionsManifest | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch {
    issues.push(issue("error", "corrections_manifest_unreadable", null, null));
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    issues.push(issue("error", "corrections_manifest_invalid", null, null));
    return null;
  }

  const candidate = parsed as Partial<CorrectionsManifest>;
  if (
    candidate.version !== 1 ||
    typeof candidate.sourceSha256 !== "string" ||
    typeof candidate.approvedBy !== "string" ||
    !(candidate.approvedAt === null || typeof candidate.approvedAt === "string") ||
    !Array.isArray(candidate.corrections) ||
    !candidate.warningApprovals ||
    typeof candidate.warningApprovals !== "object"
  ) {
    issues.push(issue("error", "corrections_manifest_invalid", null, null));
    return null;
  }

  return candidate as CorrectionsManifest;
}

function applyCorrections(
  rows: SourceMemberRow[],
  manifest: CorrectionsManifest | null,
  sourceSha256: string,
  issues: ValidationIssue[]
): number {
  if (!manifest) return 0;
  if (manifest.sourceSha256.toLocaleLowerCase() !== sourceSha256) {
    issues.push(issue("error", "source_hash_mismatch", null, null));
    return 0;
  }

  const hasApproval =
    manifest.approvedBy.trim() !== "" &&
    typeof manifest.approvedAt === "string" &&
    !Number.isNaN(Date.parse(manifest.approvedAt));
  if (manifest.corrections.length > 0 && !hasApproval) {
    issues.push(issue("error", "corrections_not_approved", null, null));
    return 0;
  }

  const rowByNumber = new Map(rows.map((row) => [row.sourceRow, row]));
  const seen = new Set<string>();
  let applied = 0;

  for (const correction of manifest.corrections) {
    const key = `${correction.row}:${correction.field}`;
    const validField = (MEMBER_HEADERS as readonly string[]).includes(correction.field);
    const row = rowByNumber.get(correction.row);
    if (
      !Number.isInteger(correction.row) ||
      !validField ||
      !row ||
      typeof correction.reason !== "string" ||
      correction.reason.trim() === "" ||
      !(correction.value === null || typeof correction.value === "string") ||
      seen.has(key)
    ) {
      issues.push(issue("error", "correction_invalid", correction.row ?? null, null));
      continue;
    }

    seen.add(key);
    row.values[correction.field] = correction.value ?? "";
    applied += 1;
  }

  return applied;
}

function validateRow(
  source: SourceMemberRow,
  issues: ValidationIssue[]
): ValidatedMemberRow {
  const value = source.values;
  const memberNumber = trimToNull(value.member_number);
  if (memberNumber && !/^\d+$/.test(memberNumber)) {
    issues.push(issue("error", "member_number_non_numeric", source.sourceRow, "member_number"));
  }

  const name = normalizeHumanText(value.name);
  const nickname = normalizeHumanText(value.nickname);
  const sponsorNameRaw = normalizeHumanText(value.sponsor_name_raw);
  const countryCode = trimToNull(value.country_code);

  const isAnchorMember = parseBoolean(value.is_anchor_member);
  const isFavorite = parseBoolean(value.is_favorite);
  const isHidden = parseBoolean(value.is_hidden);
  if (isAnchorMember === null) {
    issues.push(issue("error", "boolean_invalid", source.sourceRow, "is_anchor_member"));
  }
  if (isFavorite === null) {
    issues.push(issue("error", "boolean_invalid", source.sourceRow, "is_favorite"));
  }
  if (isHidden === null) {
    issues.push(issue("error", "boolean_invalid", source.sourceRow, "is_hidden"));
  }

  const side = parseSide(value.side);
  if (side === undefined) issues.push(issue("error", "side_invalid", source.sourceRow, "side"));

  const memberStatus = parseMemberStatus(value.member_status);
  if (memberStatus === null) {
    issues.push(issue("error", "member_status_invalid", source.sourceRow, "member_status"));
  }

  const birthDate = parseBirthDate(value.birth_date);
  if (birthDate === undefined) {
    issues.push(issue("error", "birth_date_invalid", source.sourceRow, "birth_date"));
  }

  if (!isCountryCode(value.country_code)) {
    issues.push(issue("error", "country_code_invalid", source.sourceRow, "country_code"));
  }

  if (!memberNumber) issues.push(issue("warning", "member_number_missing", source.sourceRow, "member_number"));
  if (!name) issues.push(issue("warning", "name_missing", source.sourceRow, "name"));
  if (!countryCode) issues.push(issue("warning", "country_code_missing", source.sourceRow, "country_code"));
  if (value.cpf !== "" && value.cpf.trim() === "") {
    issues.push(issue("warning", "cpf_whitespace_only", source.sourceRow, "cpf"));
  } else if (isSuspiciousCpf(value.cpf)) {
    issues.push(issue("warning", "cpf_suspicious", source.sourceRow, "cpf"));
  }
  if (isSuspiciousPhone(value.phone)) {
    issues.push(issue("warning", "phone_suspicious", source.sourceRow, "phone"));
  }

  const normalized: NormalizedMember = {
    memberNumber,
    name,
    nickname,
    isAnchorMember: isAnchorMember ?? false,
    isFavorite: isFavorite ?? false,
    sponsorNameRaw,
    side: side ?? null,
    birthDate: birthDate ?? null,
    phone: trimToNull(value.phone),
    countryCode: isCountryCode(value.country_code) ? countryCode : null,
    cpf: trimToNull(value.cpf),
    notes: normalizeHumanText(value.notes),
    memberStatus: memberStatus ?? "review",
    isHidden: isHidden ?? false
  };

  return {
    source,
    normalized,
    affiliationSourceRow: null,
    affiliationCandidateRows: []
  };
}

function validateDuplicateMemberNumbers(
  rows: ValidatedMemberRow[],
  issues: ValidationIssue[]
): void {
  const rowsByNumber = new Map<string, number[]>();
  for (const row of rows) {
    const memberNumber = row.normalized.memberNumber;
    if (!memberNumber) continue;
    const matchingRows = rowsByNumber.get(memberNumber) ?? [];
    matchingRows.push(row.source.sourceRow);
    rowsByNumber.set(memberNumber, matchingRows);
  }

  for (const matchingRows of rowsByNumber.values()) {
    if (matchingRows.length < 2) continue;
    for (const row of matchingRows) {
      issues.push(issue("error", "member_number_duplicate", row, "member_number"));
    }
  }
}

function buildDistributions(rows: ValidatedMemberRow[]): ValidationDistributions {
  const distributions: ValidationDistributions = {
    memberStatus: {},
    countryCode: {},
    side: {},
    isAnchorMember: {},
    isFavorite: {},
    isHidden: {}
  };

  for (const row of rows) {
    increment(distributions.memberStatus, row.normalized.memberStatus);
    increment(distributions.countryCode, row.normalized.countryCode ?? "null");
    increment(distributions.side, row.normalized.side ?? "null");
    increment(distributions.isAnchorMember, String(row.normalized.isAnchorMember));
    increment(distributions.isFavorite, String(row.normalized.isFavorite));
    increment(distributions.isHidden, String(row.normalized.isHidden));
  }
  return distributions;
}

function buildNullCounts(rows: ValidatedMemberRow[]): Record<string, number> {
  const fields: Array<keyof NormalizedMember> = [
    "memberNumber",
    "name",
    "nickname",
    "sponsorNameRaw",
    "side",
    "birthDate",
    "phone",
    "countryCode",
    "cpf",
    "notes"
  ];
  return Object.fromEntries(
    fields.map((field) => [
      field,
      rows.filter((row) => row.normalized[field] === null).length
    ])
  );
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  row: number | null,
  field: ValidationIssue["field"]
): ValidationIssue {
  return { severity, code, row, field };
}
