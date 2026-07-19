import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const requiredPaths = [
  "scripts/members/validate-members.ts",
  "scripts/members/prepare-members.ts",
  "scripts/members/import-members.ts",
  "supabase/004_phase2_import_rpc.sql",
  "supabase/004a_phase2_import_rpc_secret_key_compat.sql",
  "supabase/005_phase2_remove_import_rpc.sql",
  "supabase/tests/phase2_import_rollback.sql"
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`필수 Phase 2 파일이 없음: ${path}`);
}

const gitIgnore = readFileSync(join(root, ".gitignore"), "utf8");
if (!/^\/reports\/$/m.test(gitIgnore)) failures.push("reports/ 전체 ignore 규칙이 없음");
if (!/^\.env\.\*$/m.test(gitIgnore)) failures.push("로컬 import 환경변수 ignore 규칙이 없음");

const importSql = readFileSync(join(root, "supabase/004_phase2_import_rpc.sql"), "utf8");
const secretKeyCompatSql = readFileSync(
  join(root, "supabase/004a_phase2_import_rpc_secret_key_compat.sql"),
  "utf8"
);
if (/request\.jwt\.claim\.role/i.test(importSql)) {
  failures.push("새 secret key를 거부하는 레거시 JWT claim 검사가 남아 있음");
}
if (!/revoke all on function[\s\S]*from public, anon, authenticated/i.test(importSql)) {
  failures.push("RPC public/anon/authenticated 실행 권한 회수가 없음");
}
if (!/grant execute on function[\s\S]*to service_role/i.test(importSql)) {
  failures.push("RPC service_role 실행 권한 부여가 없음");
}
if (!/pg_get_functiondef[\s\S]*legacy claim block did not match/i.test(secretKeyCompatSql)) {
  failures.push("이미 적용된 004 RPC의 레거시 claim 제거 보정이 없음");
}
if (!/lock table public\.members in access exclusive mode/i.test(importSql)) {
  failures.push("members 빈 테이블 동시성 lock이 없음");
}
if (!/pg_catalog\.pg_class[\s\S]*relrowsecurity/i.test(importSql)) {
  failures.push("import 전 members RLS 활성 확인이 없음");
}

let trackedPrivateFiles = [];
try {
  trackedPrivateFiles = execFileSync("git", ["ls-files", "reports", ".env.import.local"], {
    cwd: root,
    encoding: "utf8"
  })
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  failures.push("private 파일 Git 추적 상태를 확인하지 못함");
}
if (trackedPrivateFiles.length > 0) {
  failures.push(`private 파일이 Git에 추적됨: ${trackedPrivateFiles.join(", ")}`);
}

if (failures.length > 0) {
  console.error("Phase 2 안전 검사 실패");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Phase 2 안전 검사 통과 (도구, RPC 권한, private 파일 격리)");
