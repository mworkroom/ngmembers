import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { escapeCsvCell } from "./csv";
import type {
  CorrectionsManifest,
  PreparedPayload,
  ValidationIssue,
  ValidationRun
} from "./types";

export async function writeValidationReports(
  validation: ValidationRun,
  reportDirectory: string
): Promise<void> {
  await mkdir(reportDirectory, { recursive: true });

  const summary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: {
      fileName: validation.sourceName,
      sha256: validation.sourceSha256,
      byteLength: validation.sourceByteLength,
      utf8Bom: validation.hasUtf8Bom,
      rowCount: validation.rows.length
    },
    corrections: {
      appliedCount: validation.appliedCorrectionCount
    },
    result: {
      errorCount: countSeverity(validation.issues, "error"),
      warningCount: countSeverity(validation.issues, "warning"),
      infoCount: countSeverity(validation.issues, "info"),
      warningRowCount: new Set(
        validation.issues
          .filter((entry) => entry.severity === "warning" && entry.row !== null)
          .map((entry) => entry.row)
      ).size,
      issues: validation.issues.map(({ severity, code, row, field }) => ({
        severity,
        code,
        row,
        field
      })),
      nullCounts: validation.nullCounts,
      distributions: validation.distributions,
      relations: validation.relationCounts
    }
  };

  await writeJson(join(reportDirectory, "validation-summary.json"), summary);
  await writeIssueCsv(
    join(reportDirectory, "validation-warnings.csv"),
    validation.issues.filter((entry) => entry.severity === "warning")
  );
  await writeSponsorReports(validation, reportDirectory);
}

export async function writePreparedArtifacts(
  payload: PreparedPayload,
  reportDirectory: string
): Promise<{ outputPath: string; rollbackPath: string }> {
  await mkdir(reportDirectory, { recursive: true });
  const outputPath = join(reportDirectory, "prepared-import.local.json");
  const rollbackPath = join(reportDirectory, "rollback-ids.local.json");

  await writeJson(outputPath, payload);
  await writeJson(rollbackPath, {
    version: 1,
    sourceSha256: payload.sourceSha256,
    preparedSha256: payload.preparedSha256,
    expectedCount: payload.rowCount,
    ids: payload.members.map((member) => member.id)
  });
  return { outputPath, rollbackPath };
}

export async function initializeCorrectionsManifest(
  path: string,
  sourceSha256: string
): Promise<"created" | "exists"> {
  try {
    await readFile(path);
    return "exists";
  } catch {
    const manifest: CorrectionsManifest = {
      version: 1,
      sourceSha256,
      approvedBy: "",
      approvedAt: null,
      corrections: [],
      warningApprovals: {}
    };
    await mkdir(dirname(path), { recursive: true });
    await writeJson(path, manifest);
    return "created";
  }
}

export function compactValidationSummary(validation: ValidationRun): Record<string, unknown> {
  return {
    sourceSha256: validation.sourceSha256,
    rowCount: validation.rows.length,
    errorCount: countSeverity(validation.issues, "error"),
    warningCount: countSeverity(validation.issues, "warning"),
    warningRowCount: new Set(
      validation.issues
        .filter((entry) => entry.severity === "warning" && entry.row !== null)
        .map((entry) => entry.row)
    ).size,
    correctionsApplied: validation.appliedCorrectionCount,
    relations: validation.relationCounts,
    nullCounts: validation.nullCounts,
    distributions: validation.distributions
  };
}

function countSeverity(
  issues: ValidationIssue[],
  severity: ValidationIssue["severity"]
): number {
  return issues.filter((entry) => entry.severity === severity).length;
}

async function writeIssueCsv(path: string, issues: ValidationIssue[]): Promise<void> {
  const rows = [
    ["severity", "code", "source_row", "field"],
    ...issues.map((entry) => [
      entry.severity,
      entry.code,
      entry.row ?? "",
      entry.field ?? ""
    ])
  ];
  await writeFile(
    path,
    `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`,
    "utf8"
  );
}

async function writeSponsorReports(
  validation: ValidationRun,
  reportDirectory: string
): Promise<void> {
  const unresolvedRows = validation.rows
    .filter(
      (row) =>
        row.normalized.sponsorNameRaw !== null &&
        row.affiliationCandidateRows.length === 0
    )
    .map((row) => [
      row.source.sourceRow,
      row.normalized.memberNumber,
      row.normalized.name,
      row.normalized.nickname,
      row.normalized.sponsorNameRaw
    ]);

  const ambiguousRows = validation.rows
    .filter(
      (row) =>
        row.affiliationCandidateRows.length > 1 &&
        !row.affiliationCandidateRows.includes(row.source.sourceRow)
    )
    .map((row) => [
      row.source.sourceRow,
      row.normalized.memberNumber,
      row.normalized.name,
      row.normalized.nickname,
      row.normalized.sponsorNameRaw,
      row.affiliationCandidateRows.join(";")
    ]);

  await writePrivateCsv(
    join(reportDirectory, "unresolved-sponsors.csv"),
    ["source_row", "member_number", "name", "nickname", "sponsor_name_raw"],
    unresolvedRows
  );
  await writePrivateCsv(
    join(reportDirectory, "ambiguous-sponsors.csv"),
    [
      "source_row",
      "member_number",
      "name",
      "nickname",
      "sponsor_name_raw",
      "candidate_source_rows"
    ],
    ambiguousRows
  );
}

async function writePrivateCsv(
  path: string,
  headers: string[],
  rows: unknown[][]
): Promise<void> {
  const allRows = [headers, ...rows];
  await writeFile(
    path,
    `${allRows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`,
    "utf8"
  );
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
