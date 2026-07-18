import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";
import { Phase2Error } from "../lib/errors";
import {
  prepareMembers,
  readAndVerifyPreparedPayload
} from "../lib/prepared";
import { validateMembers } from "../lib/validation";

const fixturePath = resolve("scripts/members/__fixtures__/valid-members.csv");

test("strict validator accepts the fake fixture and resolves exact sponsors", async () => {
  const validation = await validateMembers({ sourcePath: fixturePath });

  assert.equal(validation.rows.length, 3);
  assert.equal(count(validation, "error"), 0);
  assert.equal(count(validation, "warning"), 0);
  assert.deepEqual(validation.relationCounts, {
    linked: 2,
    unresolved: 0,
    ambiguous: 0,
    self: 0,
    missing: 1
  });
  assert.equal(validation.rows[1].normalized.birthDate, "1992-02-29");
  assert.equal(validation.rows[1].normalized.side, "left");
});

test("invalid date and self sponsor remain blocking errors until approved correction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ngmembers-phase2-invalid-"));
  const sourcePath = join(directory, "invalid.csv");
  const fixture = await readFile(fixturePath, "utf8");
  await writeFile(
    sourcePath,
    fixture
      .replace("19920229", "19920230")
      .replace("900000002,가상 회원 둘,가상둘,FALSE,가상하나", "900000002,가상 회원 둘,가상둘,FALSE,가상둘"),
    "utf8"
  );

  const validation = await validateMembers({ sourcePath });
  const errorCodes = validation.issues
    .filter((entry) => entry.severity === "error")
    .map((entry) => entry.code);
  assert(errorCodes.includes("birth_date_invalid"));
  assert(errorCodes.includes("self_sponsor"));
});

test("prepare is deterministic and requires a source-bound approval manifest", async () => {
  const validation = await validateMembers({ sourcePath: fixturePath });
  const directory = await mkdtemp(join(tmpdir(), "ngmembers-phase2-prepare-"));
  const manifestPath = join(directory, "corrections.local.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      version: 1,
      sourceSha256: validation.sourceSha256,
      approvedBy: "Fixture Reviewer",
      approvedAt: "2026-07-18T00:00:00.000Z",
      corrections: [],
      warningApprovals: {}
    }),
    "utf8"
  );

  const first = await prepareMembers({
    sourcePath: fixturePath,
    correctionsPath: manifestPath,
    reportDirectory: join(directory, "first")
  });
  const second = await prepareMembers({
    sourcePath: fixturePath,
    correctionsPath: manifestPath,
    reportDirectory: join(directory, "second")
  });

  assert.equal(first.payload.preparedSha256, second.payload.preparedSha256);
  assert.deepEqual(
    first.payload.members.map((member) => member.id),
    second.payload.members.map((member) => member.id)
  );
  assert.equal(first.payload.summary.relationCount, 2);
  assert(first.payload.members.every((member) => member.direct_parent_id === null));

  const tamperedPath = join(directory, "tampered.local.json");
  const tampered = structuredClone(first.payload);
  tampered.members[0].name = "변조된 가짜 이름";
  await writeFile(tamperedPath, JSON.stringify(tampered), "utf8");
  await assert.rejects(
    readAndVerifyPreparedPayload(tamperedPath),
    (error: unknown) =>
      error instanceof Phase2Error && error.code === "PREPARED_HASH_MISMATCH"
  );
});

test("prepare blocks warnings that J has not explicitly accepted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ngmembers-phase2-warning-"));
  const sourcePath = join(directory, "warning.csv");
  const fixture = await readFile(fixturePath, "utf8");
  await writeFile(sourcePath, fixture.replace(",KR,", ",,"), "utf8");
  const validation = await validateMembers({ sourcePath });
  const manifestPath = join(directory, "corrections.local.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      version: 1,
      sourceSha256: validation.sourceSha256,
      approvedBy: "Fixture Reviewer",
      approvedAt: "2026-07-18T00:00:00.000Z",
      corrections: [],
      warningApprovals: {}
    }),
    "utf8"
  );

  await assert.rejects(
    prepareMembers({
      sourcePath,
      correctionsPath: manifestPath,
      reportDirectory: join(directory, "reports")
    }),
    (error: unknown) =>
      error instanceof Phase2Error && error.code === "WARNING_APPROVAL_REQUIRED"
  );
});

test("SQL contract keeps the import RPC temporary and transaction-safe", async () => {
  const sqlPath = resolve("supabase/004_phase2_import_rpc.sql");
  const compatPath = resolve("supabase/004a_phase2_import_rpc_secret_key_compat.sql");
  const removalPath = resolve("supabase/005_phase2_remove_import_rpc.sql");
  const rollbackPath = resolve("supabase/tests/phase2_import_rollback.sql");
  const [sql, compat, removal, rollback] = await Promise.all([
    readFile(sqlPath, "utf8"),
    readFile(compatPath, "utf8"),
    readFile(removalPath, "utf8"),
    readFile(rollbackPath, "utf8")
  ]);

  assert.match(sql, /security definer/i);
  assert.match(sql, /lock table public\.members in access exclusive mode/i);
  assert.match(sql, /members table is not empty/i);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /request\.jwt\.claim\.role/i);
  assert.match(compat, /pg_get_functiondef[\s\S]*legacy claim block did not match/i);
  assert.match(compat, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.match(removal, /drop function if exists public\.phase2_import_members/i);
  assert.match(rollback, /begin;[\s\S]*rollback;/i);
});

function count(
  validation: Awaited<ReturnType<typeof validateMembers>>,
  severity: "error" | "warning" | "info"
): number {
  return validation.issues.filter((entry) => entry.severity === severity).length;
}
