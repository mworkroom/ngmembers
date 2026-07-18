import type { MemberRecord } from "../types";
import {
  booleanFromText,
  onlyDigits,
  toMemberSide,
  toMemberStatus
} from "./formatters";

export interface CsvImportResult {
  members: MemberRecord[];
  warnings: string[];
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((columns) => columns.some((value) => value.trim() !== ""));
}

export function importMembersFromCsv(text: string): CsvImportResult {
  const table = parseCsv(text);
  if (table.length < 2) {
    throw new Error("CSV에 회원 데이터가 없습니다.");
  }

  const headers = table[0].map((header) => header.trim());
  const required = ["member_number", "name"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`CSV 열이 없습니다: ${missing.join(", ")}`);
  }

  const rawRows = table.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });

  const numberCounts = new Map<string, number>();
  const members: MemberRecord[] = rawRows.map((row, index) => {
    const number = row.member_number.trim();
    const safeNumber = number.replace(/[^0-9A-Za-z_-]+/g, "-") || `row-${index + 1}`;
    const count = (numberCounts.get(safeNumber) ?? 0) + 1;
    numberCounts.set(safeNumber, count);
    const id = `csv-${safeNumber}${count > 1 ? `-${count}` : ""}`;
    const parsedStatus = toMemberStatus(row.member_status ?? "active");

    return {
      id,
      memberNumber: number,
      name: row.name.trim(),
      nickname: (row.nickname ?? "").trim(),
      isAnchorMember: booleanFromText(row.is_anchor_member ?? "false"),
      isFavorite: booleanFromText(row.is_favorite ?? "false"),
      sponsorNameRaw: (row.sponsor_name_raw ?? "").trim(),
      affiliationId: null,
      side: toMemberSide(row.side ?? ""),
      directParentId: null,
      directParentSide: toMemberSide(row.direct_parent_side ?? ""),
      birthDate: onlyDigits(row.birth_date ?? ""),
      phone: onlyDigits(row.phone ?? ""),
      countryCode: (row.country_code ?? "").trim().toUpperCase(),
      cpf: normalizeCpfValue(row.cpf ?? ""),
      notes: (row.notes ?? "").trim(),
      status: parsedStatus.status,
      isHidden: booleanFromText(row.is_hidden ?? "false"),
      importWarnings: parsedStatus.warning ? [parsedStatus.warning] : []
    };
  });

  const idsByNumber = new Map<string, string[]>();
  members.forEach((member) => {
    if (!member.memberNumber) return;
    const existing = idsByNumber.get(member.memberNumber) ?? [];
    existing.push(member.id);
    idsByNumber.set(member.memberNumber, existing);
  });

  rawRows.forEach((row, index) => {
    const member = members[index];
    const affiliationNumber = (row.affiliation_member_number ?? "").trim();
    const parentNumber = (row.direct_parent_member_number ?? "").trim();

    if (affiliationNumber) {
      const ids = idsByNumber.get(affiliationNumber) ?? [];
      if (ids.length === 1) member.affiliationId = ids[0];
      else member.importWarnings?.push(
        ids.length === 0
          ? `소속 회원번호를 찾을 수 없음: ${affiliationNumber}`
          : `소속 회원번호가 중복됨: ${affiliationNumber}`
      );
    }

    if (parentNumber) {
      const ids = idsByNumber.get(parentNumber) ?? [];
      if (ids.length === 1) member.directParentId = ids[0];
      else member.importWarnings?.push(
        ids.length === 0
          ? `바로 위 회원번호를 찾을 수 없음: ${parentNumber}`
          : `바로 위 회원번호가 중복됨: ${parentNumber}`
      );
    }
  });

  const warnings: string[] = [];
  const duplicateNumbers = [...idsByNumber.entries()].filter(([, ids]) => ids.length > 1);
  if (duplicateNumbers.length > 0) {
    warnings.push(`중복 회원번호 ${duplicateNumbers.length}개가 포함되어 있습니다.`);
  }

  return { members, warnings };
}

export function exportMembersToCsv(members: MemberRecord[]): string {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const headers = [
    "member_number",
    "name",
    "nickname",
    "is_anchor_member",
    "sponsor_name_raw",
    "side",
    "birth_date",
    "phone",
    "country_code",
    "cpf",
    "notes",
    "member_status",
    "is_favorite",
    "is_hidden",
    "affiliation_member_number",
    "direct_parent_member_number",
    "direct_parent_side"
  ];

  const rows = members.map((member) => [
    member.memberNumber,
    member.name,
    member.nickname,
    member.isAnchorMember ? "TRUE" : "FALSE",
    member.sponsorNameRaw,
    sideToCsv(member.side),
    member.birthDate,
    member.phone,
    member.countryCode,
    member.cpf,
    member.notes,
    member.status,
    member.isFavorite ? "TRUE" : "FALSE",
    member.isHidden ? "TRUE" : "FALSE",
    member.affiliationId
      ? memberById.get(member.affiliationId)?.memberNumber ?? ""
      : "",
    member.directParentId
      ? memberById.get(member.directParentId)?.memberNumber ?? ""
      : "",
    sideToCsv(member.directParentSide)
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

function normalizeCpfValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /\d/.test(trimmed) ? onlyDigits(trimmed) : trimmed;
}

function sideToCsv(side: MemberRecord["side"]): string {
  if (side === "left") return "좌";
  if (side === "right") return "우";
  return "";
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
