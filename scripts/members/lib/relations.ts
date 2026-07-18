import { normalizeRelationKey } from "./normalize";
import type {
  RelationCounts,
  ValidatedMemberRow,
  ValidationIssue
} from "./types";

export function resolveSponsorRelations(
  rows: ValidatedMemberRow[],
  issues: ValidationIssue[]
): RelationCounts {
  const candidatesByKey = new Map<string, Set<number>>();

  for (const row of rows) {
    for (const value of [
      row.normalized.nickname,
      row.normalized.name,
      row.normalized.memberNumber
    ]) {
      const key = normalizeRelationKey(value);
      if (!key) continue;
      const candidates = candidatesByKey.get(key) ?? new Set<number>();
      candidates.add(row.source.sourceRow);
      candidatesByKey.set(key, candidates);
    }
  }

  const counts: RelationCounts = {
    linked: 0,
    unresolved: 0,
    ambiguous: 0,
    self: 0,
    missing: 0
  };

  for (const row of rows) {
    const sponsorKey = normalizeRelationKey(row.normalized.sponsorNameRaw);
    if (!sponsorKey) {
      counts.missing += 1;
      issues.push(issue("info", "sponsor_missing", row.source.sourceRow, "sponsor_name_raw"));
      if (row.normalized.side !== null) {
        issues.push(issue("warning", "side_without_sponsor", row.source.sourceRow, "side"));
      }
      continue;
    }

    const candidateRows = [...(candidatesByKey.get(sponsorKey) ?? new Set<number>())]
      .sort((a, b) => a - b);
    row.affiliationCandidateRows = candidateRows;

    if (candidateRows.includes(row.source.sourceRow)) {
      counts.self += 1;
      issues.push(issue("error", "self_sponsor", row.source.sourceRow, "sponsor_name_raw"));
      continue;
    }

    if (candidateRows.length === 1) {
      counts.linked += 1;
      row.affiliationSourceRow = candidateRows[0];
      continue;
    }

    if (candidateRows.length === 0) {
      counts.unresolved += 1;
      issues.push(issue("warning", "sponsor_unresolved", row.source.sourceRow, "sponsor_name_raw"));
      continue;
    }

    counts.ambiguous += 1;
    issues.push(issue("warning", "sponsor_ambiguous", row.source.sourceRow, "sponsor_name_raw"));
  }

  return counts;
}

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  row: number,
  field: ValidationIssue["field"]
): ValidationIssue {
  return { severity, code, row, field };
}
