import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Phase2Error } from "./errors";
import {
  deterministicMemberUuid,
  hashCanonicalJson
} from "./hash";
import {
  writePreparedArtifacts,
  writeValidationReports
} from "./reports";
import type {
  PreparedMember,
  PreparedPayload,
  PreparedPayloadBase,
  PreparationResult,
  ValidationRun
} from "./types";
import { validateMembers } from "./validation";

export interface PrepareMembersOptions {
  sourcePath: string;
  correctionsPath: string;
  reportDirectory: string;
}

export async function prepareMembers(
  options: PrepareMembersOptions
): Promise<PreparationResult> {
  const validation = await validateMembers({
    sourcePath: options.sourcePath,
    correctionsPath: options.correctionsPath
  });
  await writeValidationReports(validation, options.reportDirectory);
  assertPreparationAllowed(validation);

  const idBySourceRow = new Map(
    validation.rows.map((row) => [
      row.source.sourceRow,
      deterministicMemberUuid(validation.sourceSha256, row.source.sourceRow)
    ])
  );

  const members: PreparedMember[] = validation.rows.map((row) => ({
    id: idBySourceRow.get(row.source.sourceRow)!,
    member_number: row.normalized.memberNumber,
    name: row.normalized.name,
    nickname: row.normalized.nickname,
    is_anchor_member: row.normalized.isAnchorMember,
    is_favorite: row.normalized.isFavorite,
    sponsor_name_raw: row.normalized.sponsorNameRaw,
    affiliation_id: row.affiliationSourceRow
      ? idBySourceRow.get(row.affiliationSourceRow) ?? null
      : null,
    side: row.normalized.side,
    direct_parent_id: null,
    direct_parent_side: null,
    birth_date: row.normalized.birthDate,
    phone: row.normalized.phone,
    country_code: row.normalized.countryCode,
    cpf: row.normalized.cpf,
    notes: row.normalized.notes,
    member_status: row.normalized.memberStatus,
    is_hidden: row.normalized.isHidden
  }));

  const base: PreparedPayloadBase = {
    version: 1,
    sourceSha256: validation.sourceSha256,
    rowCount: members.length,
    summary: {
      rowCount: members.length,
      relationCount: members.filter((member) => member.affiliation_id !== null).length,
      nullCounts: validation.nullCounts,
      distributions: validation.distributions,
      relationCounts: validation.relationCounts
    },
    members
  };
  const payload: PreparedPayload = {
    ...base,
    preparedSha256: hashCanonicalJson(base)
  };
  const artifacts = await writePreparedArtifacts(payload, options.reportDirectory);

  return {
    validation,
    payload,
    outputPath: artifacts.outputPath,
    rollbackPath: artifacts.rollbackPath
  };
}

export async function readAndVerifyPreparedPayload(path: string): Promise<PreparedPayload> {
  let payload: PreparedPayload;
  try {
    payload = JSON.parse(await readFile(resolve(path), "utf8")) as PreparedPayload;
  } catch {
    throw new Phase2Error("PREPARED_PAYLOAD_UNREADABLE");
  }

  if (
    payload?.version !== 1 ||
    typeof payload.sourceSha256 !== "string" ||
    typeof payload.preparedSha256 !== "string" ||
    !Number.isInteger(payload.rowCount) ||
    !Array.isArray(payload.members) ||
    payload.members.length !== payload.rowCount ||
    !payload.summary
  ) {
    throw new Phase2Error("PREPARED_PAYLOAD_INVALID");
  }

  const { preparedSha256, ...base } = payload;
  if (hashCanonicalJson(base) !== preparedSha256) {
    throw new Phase2Error("PREPARED_HASH_MISMATCH");
  }
  return payload;
}

function assertPreparationAllowed(validation: ValidationRun): void {
  if (validation.issues.some((entry) => entry.severity === "error")) {
    throw new Phase2Error("VALIDATION_ERRORS_PRESENT");
  }

  const manifest = validation.correctionsManifest;
  if (!manifest || manifest.sourceSha256 !== validation.sourceSha256) {
    throw new Phase2Error("APPROVED_MANIFEST_REQUIRED");
  }
  if (
    manifest.approvedBy.trim() === "" ||
    typeof manifest.approvedAt !== "string" ||
    Number.isNaN(Date.parse(manifest.approvedAt))
  ) {
    throw new Phase2Error("APPROVED_MANIFEST_REQUIRED");
  }

  const warningCodes = new Set(
    validation.issues
      .filter((entry) => entry.severity === "warning")
      .map((entry) => entry.code)
  );
  for (const code of warningCodes) {
    const approval = manifest.warningApprovals[code];
    if (
      approval?.decision !== "accept" ||
      typeof approval.reason !== "string" ||
      approval.reason.trim() === ""
    ) {
      throw new Phase2Error("WARNING_APPROVAL_REQUIRED");
    }
  }
}
