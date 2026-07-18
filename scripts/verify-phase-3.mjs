import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const requiredPaths = [
  "src/types/database.ts",
  "src/lib/memberMapper.ts",
  "src/lib/memberRepository.ts",
  "src/hooks/useMembers.ts",
  "src/lib/legacyStorageCleanup.ts",
  "supabase/migrations/20260718024656_phase3_members_access_hardening.sql",
  "supabase/tests/phase3_members_access_and_cycle.sql"
];
const removedPaths = [
  "src/lib/storage.ts",
  "src/data/demoMembers.ts",
  "src/utils/csv.ts"
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`필수 결과물이 없음: ${path}`);
}
for (const path of removedPaths) {
  if (existsSync(join(root, path))) failures.push(`제거 대상 파일이 남아 있음: ${path}`);
}

const app = read("src/App.tsx");
const management = read("src/components/ManagementPanel.tsx");
const repository = read("src/lib/memberRepository.ts");
const mapper = read("src/lib/memberMapper.ts");
const client = read("src/lib/supabase.ts");
const migration = read(
  "supabase/migrations/20260718024656_phase3_members_access_hardening.sql"
).toLowerCase();
const freshInstallRls = read("supabase/003_rls_policies.sql").toLowerCase();

for (const [name, content] of [["App", app], ["ManagementPanel", management]]) {
  for (const forbidden of ["importMembersFromCsv", "exportMembersToCsv", "onRestore", "onReset", "onImportCsv", "onExportCsv"]) {
    if (content.includes(forbidden)) failures.push(`${name}에 위험 기능이 남아 있음: ${forbidden}`);
  }
}

if (/\.delete\s*\(|truncateMembers|deleteMember|restoreMember|replaceMembersFromCsv/.test(repository)) {
  failures.push("member repository에 금지된 삭제·교체 함수가 있음");
}
if (!repository.includes(".gt(\"id\", cursor)") || !repository.includes(".limit(MEMBER_PAGE_SIZE)")) {
  failures.push("UUID cursor 500행 loader가 확인되지 않음");
}
if (!repository.includes("count: \"exact\"") || !repository.includes("seenIds")) {
  failures.push("전체 count 또는 중복 ID 완전성 검사가 확인되지 않음");
}
if ((repository.match(/\.eq\(\"updated_at\", expectedUpdatedAt\)/g) ?? []).length !== 2) {
  failures.push("update/hide의 updated_at conflict 조건이 확인되지 않음");
}
if (!mapper.includes("createdAt") || !mapper.includes("updatedAt")) {
  failures.push("mapper에 created_at/updated_at 변환이 없음");
}
if (!client.includes("createClient<Database>")) {
  failures.push("Supabase client에 production Database generic이 연결되지 않음");
}

for (const sql of [migration, freshInstallRls]) {
  if (!/revoke\s+all\s+on\s+table\s+public\.members\s+from\s+public,\s*anon,\s*authenticated/.test(sql)) {
    failures.push("members 최소 권한 revoke가 누락됨");
  }
  if (!/grant\s+select,\s*insert,\s*update\s+on\s+table\s+public\.members\s+to\s+authenticated/.test(sql)) {
    failures.push("authenticated 최소 grant가 누락됨");
  }
  if (!sql.includes("security invoker") || !sql.includes("volatile") || !sql.includes("set search_path = ''")) {
    failures.push("cycle trigger function 보안 설정이 누락됨");
  }
  if (!sql.includes("members_prevent_relation_cycle")) {
    failures.push("relation cycle trigger가 누락됨");
  }
  if (!sql.includes("pg_advisory_xact_lock")) {
    failures.push("동시 relation 변경을 직렬화하는 advisory lock이 누락됨");
  }
}

const sourceFiles = walk(join(root, "src"));
for (const file of sourceFiles) {
  const content = readFileSync(file, "utf8");
  if (/localStorage\.setItem|indexedDB\.open|caches\.open/.test(content)) {
    failures.push(`회원 데이터 영속 저장 가능성이 있음: ${relative(file)}`);
  }
}

if (failures.length > 0) {
  console.error("Phase 3 안전 검사 실패");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Phase 3 안전 검사 통과 (${sourceFiles.length}개 src 파일)`);

function read(path) {
  const fullPath = join(root, path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if ([".ts", ".tsx"].includes(extname(path))) files.push(path);
  }
  return files;
}

function relative(path) {
  return path.slice(root.length + 1).replaceAll("\\", "/");
}
