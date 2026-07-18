import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const forbiddenPaths = [
  "src/data/seedMembers.json",
  "data/members_sample.csv",
  "assets/index-DhHxHh3o.js",
  "assets/index-C3QC9xHP.css"
];

for (const path of forbiddenPaths) {
  if (existsSync(join(root, path))) {
    failures.push(`제거 대상 파일이 남아 있음: ${path}`);
  }
}

for (const requiredPath of [
  "dist/index.html",
  "src/lib/supabase.ts",
  "supabase/001_members_schema.sql",
  "supabase/002_workspace_access.sql",
  "supabase/003_rls_policies.sql"
]) {
  if (!existsSync(join(root, requiredPath))) {
    failures.push(`필수 결과물이 없음: ${requiredPath}`);
  }
}

const currentFiles = walk(root, new Set([".git", "node_modules"]));
const textFiles = currentFiles.filter(isTextFile);

for (const file of textFiles) {
  const content = readFileSync(file, "utf8");
  if (/sb_secret_[A-Za-z0-9._-]{12,}/.test(content)) {
    failures.push(`secret key 형태 문자열 발견: ${relative(file)}`);
  }

  for (const jwt of content.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    if (getJwtRole(jwt[0]) === "service_role") {
      failures.push(`service role JWT 발견: ${relative(file)}`);
    }
  }
}

const historicalMarkers = loadHistoricalMarkers();
const localMarkers = loadLocalMarkers();
const piiMarkers = deduplicateMarkers([...historicalMarkers, ...localMarkers]);
if (piiMarkers.length > 0) {
  for (const file of textFiles) {
    const content = readFileSync(file, "utf8");
    const match = piiMarkers.find((marker) => content.includes(marker.value));
    if (match) {
      const line = content.slice(0, content.indexOf(match.value)).split(/\r?\n/).length;
      failures.push(`이전 seed의 ${match.field} 값 발견: ${relative(file)}:${line}`);
    }
  }
}

const rlsSqlPath = join(root, "supabase/003_rls_policies.sql");
if (existsSync(rlsSqlPath)) {
  const rlsSql = readFileSync(rlsSqlPath, "utf8").toLowerCase();
  if (/create\s+policy[\s\S]*?for\s+delete/.test(rlsSql)) {
    failures.push("members DELETE policy가 정의되어 있음");
  }
  const revokesDelete = /revoke\s+delete\s+on\s+public\.members\s+from\s+public,\s*anon,\s*authenticated/.test(rlsSql);
  const revokesAll = /revoke\s+all\s+on\s+table\s+public\.members\s+from\s+public,\s*anon,\s*authenticated/.test(rlsSql);
  if (!revokesDelete && !revokesAll) {
    failures.push("authenticated DELETE 포함 권한 회수가 없음");
  }
}

if (failures.length > 0) {
  console.error("Phase 1 안전 검사 실패");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

const markerSource = historicalMarkers.length > 0
  ? `과거 Git seed ${historicalMarkers.length}개`
  : localMarkers.length > 0
    ? `로컬 marker ${localMarkers.length}개`
    : "PII baseline 없음";
console.log(`Phase 1 안전 검사 통과 (${textFiles.length}개 파일, ${markerSource})`);

function walk(directory, ignoredNames) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (ignoredNames.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path, ignoredNames));
    else files.push(path);
  }
  return files;
}

function isTextFile(path) {
  return new Set([
    ".css",
    ".example",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".sql",
    ".ts",
    ".tsx"
  ]).has(extname(path));
}

function loadHistoricalMarkers() {
  let source;
  try {
    source = execFileSync(
      "git",
      ["show", "HEAD:src/data/seedMembers.json"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
  } catch {
    return [];
  }

  try {
    const records = JSON.parse(source);
    const fields = [
      "memberNumber",
      "name",
      "nickname",
      "sponsorNameRaw",
      "birthDate",
      "phone",
      "cpf"
    ];
    const seen = new Set();
    const markers = [];

    for (const record of records) {
      for (const field of fields) {
        const value = typeof record[field] === "string" ? record[field].trim() : "";
        const minimumLength = ["name", "nickname", "sponsorNameRaw"].includes(field) ? 3 : 7;
        if (value.length < minimumLength || seen.has(value)) continue;
        seen.add(value);
        markers.push({ field, value });
      }
    }
    return markers;
  } catch {
    return [];
  }
}

function loadLocalMarkers() {
  const markerPath = join(root, "scripts/pii-markers.local.txt");
  if (!existsSync(markerPath)) return [];

  return readFileSync(markerPath, "utf8")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && !value.startsWith("#"))
    .map((value) => ({ field: "local marker", value }));
}

function deduplicateMarkers(markers) {
  const seen = new Set();
  return markers.filter((marker) => {
    if (seen.has(marker.value)) return false;
    seen.add(marker.value);
    return true;
  });
}

function getJwtRole(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

function relative(path) {
  return path.slice(root.length + 1).replaceAll("\\", "/");
}
