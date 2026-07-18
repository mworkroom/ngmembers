import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import {
  flagPath,
  flagString,
  hasFlag,
  parseCliArgs
} from "./lib/cli";
import { readUtf8Csv } from "./lib/csv";
import {
  isServiceRoleCredential,
  loadImportEnvironment,
  projectRefFromUrl
} from "./lib/env";
import { Phase2Error, safeErrorCode } from "./lib/errors";
import { canonicalJson } from "./lib/hash";
import { readAndVerifyPreparedPayload } from "./lib/prepared";

const args = parseCliArgs(process.argv.slice(2));
const apply = hasFlag(args, "apply");
const preflight = hasFlag(args, "preflight");
const preparedPath =
  flagPath(args, "prepared") ?? resolve("reports/phase2/prepared-import.local.json");
const sourcePath = flagPath(args, "source");
const envPath = flagPath(args, "env-file") ?? resolve(".env.import.local");

try {
  if (apply && preflight) throw new Phase2Error("IMPORT_MODE_CONFLICT");

  const payload = await readAndVerifyPreparedPayload(preparedPath);
  const environment = await loadImportEnvironment(envPath);
  const source = sourcePath ? await readUtf8Csv(sourcePath) : null;

  if (source && source.sha256 !== payload.sourceSha256) {
    throw new Phase2Error("SOURCE_HASH_MISMATCH");
  }

  const baseSummary = {
    mode: apply ? "apply" : preflight ? "preflight" : "dry-run",
    sourceSha256: payload.sourceSha256,
    preparedSha256: payload.preparedSha256,
    expectedInsertCount: payload.rowCount,
    expectedRelationCount: payload.summary.relationCount,
    targetConfigured: environment !== null,
    targetProjectRef: environment?.expectedProjectRef ?? null,
    backupConfirmed: hasFlag(args, "backup-confirmed")
  };

  if (!apply && !preflight) {
    console.log(JSON.stringify({ ...baseSummary, summary: payload.summary }, null, 2));
    process.exit(0);
  }

  if (!sourcePath || !source) throw new Phase2Error("SOURCE_PATH_REQUIRED");
  if (!environment) throw new Phase2Error("IMPORT_ENVIRONMENT_REQUIRED");
  if (!isServiceRoleCredential(environment.serviceRoleKey)) {
    throw new Phase2Error("SERVICE_ROLE_CREDENTIAL_REQUIRED");
  }
  const actualProjectRef = projectRefFromUrl(environment.supabaseUrl);
  if (
    !actualProjectRef ||
    actualProjectRef !== environment.expectedProjectRef
  ) {
    throw new Phase2Error("TARGET_PROJECT_REF_MISMATCH");
  }

  const supabase = createClient(environment.supabaseUrl, environment.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  const beforeCount = await getMemberCount(supabase);

  if (preflight) {
    const phase1TestMarkerCount =
      beforeCount > 0
        ? await getMemberCountByMemberNumber(supabase, "phase1-check")
        : 0;
    console.log(
      JSON.stringify(
        {
          ...baseSummary,
          targetProjectRef: actualProjectRef,
          sourceHashVerified: source.sha256 === payload.sourceSha256,
          preparedHashVerified: true,
          membersCount: beforeCount,
          membersEmpty: beforeCount === 0,
          knownPhase1TestMarkerCount: phase1TestMarkerCount,
          backupVerification: "manual-required",
          rpcMigrationVerification: "manual-required",
          readyForApplyPreconditions: beforeCount === 0
        },
        null,
        2
      )
    );
    if (beforeCount !== 0) throw new Phase2Error("TARGET_MEMBERS_NOT_EMPTY");
  } else {
    const expectedCount = parseRequiredInteger(args, "expected-count");
    const approvedSourceSha = requiredFlag(args, "source-sha256");
    const approvedPreparedSha = requiredFlag(args, "prepared-sha256");
    const confirmedProjectRef = requiredFlag(args, "confirm-project-ref");

    if (!hasFlag(args, "backup-confirmed")) {
      throw new Phase2Error("BACKUP_CONFIRMATION_REQUIRED");
    }
    if (expectedCount !== payload.rowCount) throw new Phase2Error("EXPECTED_COUNT_MISMATCH");
    if (approvedSourceSha !== payload.sourceSha256 || approvedSourceSha !== source.sha256) {
      throw new Phase2Error("APPROVED_SOURCE_HASH_MISMATCH");
    }
    if (approvedPreparedSha !== payload.preparedSha256) {
      throw new Phase2Error("APPROVED_PREPARED_HASH_MISMATCH");
    }
    if (confirmedProjectRef !== environment.expectedProjectRef) {
      throw new Phase2Error("TARGET_PROJECT_REF_MISMATCH");
    }
    if (beforeCount !== 0) throw new Phase2Error("TARGET_MEMBERS_NOT_EMPTY");

    const { data, error } = await supabase.rpc("phase2_import_members", {
      p_payload: payload,
      p_expected_count: expectedCount,
      p_source_sha256: approvedSourceSha,
      p_prepared_sha256: approvedPreparedSha
    });

    if (error) {
      const countAfterFailure = await getMemberCount(supabase).catch(() => null);
      console.error(
        JSON.stringify({
          mode: "apply",
          rpcSucceeded: false,
          membersCountAfterFailure: countAfterFailure,
          automaticRetry: false
        })
      );
      throw new Phase2Error("IMPORT_RPC_FAILED_NO_RETRY");
    }

    verifyRpcSummary(data, payload.rowCount, payload.summary.relationCount, payload.summary.distributions);
    console.log(
      JSON.stringify(
        {
          ...baseSummary,
          rpcSucceeded: true,
          databaseSummary: data,
          nextRequiredStep: "verify-access-then-run-005_phase2_remove_import_rpc.sql"
        },
        null,
        2
      )
    );
  }
} catch (error) {
  console.error(`Phase 2 import stopped: ${safeErrorCode(error)}`);
  process.exitCode = 1;
}

function requiredFlag(
  argsValue: ReturnType<typeof parseCliArgs>,
  name: string
): string {
  const value = flagString(argsValue, name);
  if (!value) throw new Phase2Error(`REQUIRED_FLAG_${name.toUpperCase().replaceAll("-", "_")}`);
  return value;
}

function parseRequiredInteger(
  argsValue: ReturnType<typeof parseCliArgs>,
  name: string
): number {
  const raw = requiredFlag(argsValue, name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Phase2Error(`INVALID_FLAG_${name.toUpperCase().replaceAll("-", "_")}`);
  }
  return value;
}

async function getMemberCount(
  supabase: ReturnType<typeof createClient<any, "public", any>>
): Promise<number> {
  const { count, error } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true });
  if (error || count === null) throw new Phase2Error("TARGET_COUNT_CHECK_FAILED");
  return count;
}

async function getMemberCountByMemberNumber(
  supabase: ReturnType<typeof createClient<any, "public", any>>,
  memberNumber: string
): Promise<number> {
  const { count, error } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("member_number", memberNumber);
  if (error || count === null) throw new Phase2Error("TARGET_COUNT_CHECK_FAILED");
  return count;
}

function verifyRpcSummary(
  data: unknown,
  expectedCount: number,
  expectedRelationCount: number,
  expectedDistributions: unknown
): void {
  if (!data || typeof data !== "object") throw new Phase2Error("RPC_SUMMARY_INVALID");
  const summary = data as Record<string, unknown>;
  if (
    summary.rowCount !== expectedCount ||
    summary.relationCount !== expectedRelationCount ||
    summary.directParentCount !== 0 ||
    summary.timestampsMissing !== 0 ||
    canonicalJson(summary.distributions) !== canonicalJson(expectedDistributions)
  ) {
    throw new Phase2Error("RPC_SUMMARY_MISMATCH");
  }
}
