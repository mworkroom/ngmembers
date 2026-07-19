import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const textExtensions = new Set([
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".local",
  ".mjs",
  ".md",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml"
]);
const piiFields = [
  "memberNumber",
  "name",
  "nickname",
  "sponsorNameRaw",
  "birthDate",
  "phone",
  "cpf"
];

checkTrackedPrivateFiles();
checkWorkingTreeSecretsAndPii();
checkGitHistorySecretsAndPii();
checkDistArtifact();
checkSupabaseContracts();

if (failures.length > 0) {
  console.error("Phase 5 최종 안전 검사 실패");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Phase 5 최종 안전 검사 통과 (Phase 1–4, source/dist, Git history, Pages artifact, Supabase 계약)");

function checkTrackedPrivateFiles() {
  let tracked;
  try {
    tracked = git(["ls-files"]).split(/\r?\n/).filter(Boolean);
  } catch {
    failures.push("Git tracked file 목록을 읽지 못함");
    return;
  }

  const privateFiles = tracked.filter((path) => {
    const normalized = path.replaceAll("\\", "/");
    return (
      normalized.startsWith("reports/") ||
      normalized.startsWith("docs/reports/private/") ||
      /^\.env\.(?!example$|import\.example$)/i.test(normalized) ||
      /(^|\/)(prepared-import|corrections)\.(json|csv)$/i.test(normalized)
    );
  });

  if (privateFiles.length > 0) {
    failures.push(`private 파일이 Git에 추적됨 (${privateFiles.length}개)`);
  }
}

function checkWorkingTreeSecretsAndPii() {
  const files = walk(root, new Set([".git", "node_modules"])).filter(isTextFile);
  const sourceFiles = walk(join(root, "src"), new Set()).filter(isTextFile);
  const distFiles = existsSync(join(root, "dist"))
    ? walk(join(root, "dist"), new Set()).filter(isTextFile)
    : [];

  scanSecrets(files, "working tree");
  const markers = loadPiiMarkersFromWorkingTree();
  scanPii(sourceFiles, markers, "source");
  scanPii(distFiles, markers, "dist");
}

function checkGitHistorySecretsAndPii() {
  const blobs = loadGitTextBlobs();
  if (blobs.length === 0) {
    failures.push("Git history의 text blob을 읽지 못함");
    return;
  }

  scanSecrets(blobs.map((blob) => ({ path: blob.path, content: blob.content })), "Git history");
  const markers = loadPiiMarkersFromHistory(blobs);
  scanPii(
    blobs.map((blob) => ({ path: blob.path, content: blob.content })),
    markers,
    "Git history"
  );
}

function checkDistArtifact() {
  const distIndexPath = join(root, "dist", "index.html");
  if (!existsSync(distIndexPath)) {
    failures.push("dist/index.html이 없음");
    return;
  }

  const sourceIndex = readFileSync(join(root, "index.html"), "utf8");
  const distIndex = readFileSync(distIndexPath, "utf8");
  const assetPaths = [...distIndex.matchAll(/(?:src|href)=["'](\.\/assets\/[^"']+)["']/g)]
    .map((match) => match[1]);

  if (assetPaths.length === 0) failures.push("dist/index.html에서 hashed asset 경로를 찾지 못함");
  for (const assetPath of assetPaths) {
    const assetFile = resolve(join(root, "dist"), assetPath.replace("./", ""));
    if (!assetFile.startsWith(resolve(join(root, "dist")) + "\\") && !assetFile.startsWith(resolve(join(root, "dist")) + "/")) {
      failures.push("dist/index.html의 asset 경로가 dist 밖을 가리킴");
      continue;
    }
    if (!existsSync(assetFile)) failures.push(`dist asset이 없음: ${assetPath}`);
  }

  if (walk(join(root, "dist"), new Set()).some((path) => extname(path) === ".map")) {
    failures.push("배포 dist에 source map이 포함됨");
  }

  const pretendardPattern = /https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard@v1\.3\.9\/dist\/web\/variable\/pretendardvariable\.min\.css/;
  if (!pretendardPattern.test(sourceIndex) || !pretendardPattern.test(distIndex)) {
    failures.push("source/dist index.html의 외부 Pretendard stylesheet link가 기준과 다름");
  }
}

function checkSupabaseContracts() {
  const rls = readText("supabase/003_rls_policies.sql").toLowerCase();
  const access = readText("supabase/002_workspace_access.sql").toLowerCase();
  const migration = readText("supabase/migrations/20260718024656_phase3_members_access_hardening.sql").toLowerCase();
  const combined = `${rls}\n${migration}`;

  if (!/grant\s+select,\s*insert,\s*update\s+on\s+table\s+public\.members\s+to\s+authenticated/.test(rls)) {
    failures.push("members authenticated 최소 grant가 확인되지 않음");
  }
  if (/grant\s+(?:all|[^;]*\bdelete\b|[^;]*\btruncate\b|[^;]*\breferences\b|[^;]*\btrigger\b)\s+on\s+(?:table\s+)?public\.members\s+to\s+(?:public|anon|authenticated)/.test(combined)) {
    failures.push("members에 과다 grant가 정의됨");
  }
  if (/create\s+policy[\s\S]*?for\s+delete/.test(rls)) {
    failures.push("members DELETE policy가 정의됨");
  }
  for (const content of [rls, migration]) {
    if (!content.includes("revoke all on table public.members from public, anon, authenticated")) {
      failures.push("members 전체 권한 revoke가 누락됨");
    }
    if (!content.includes("security invoker") || !content.includes("volatile") || !content.includes("set search_path = ''")) {
      failures.push("cycle trigger function 보안 설정이 누락됨");
    }
    if (!content.includes("members_prevent_relation_cycle") || !content.includes("pg_advisory_xact_lock")) {
      failures.push("cycle trigger 또는 동시성 advisory lock이 누락됨");
    }
  }
  if (!access.includes("grant execute on function public.has_ngmembers_admin_access() to authenticated")) {
    failures.push("Admin access function execute 권한이 확인되지 않음");
  }
  if (!access.includes("grant execute on function public.get_ngmembers_access() to authenticated")) {
    failures.push("access 조회 function execute 권한이 확인되지 않음");
  }
}

function scanSecrets(files, scope) {
  let secretCount = 0;
  for (const file of files) {
    const content = getFileContent(file);
    if (/sb_secret_[A-Za-z0-9._-]{12,}/.test(content)) secretCount += 1;
    for (const token of content.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      if (getJwtRole(token[0]) === "service_role") secretCount += 1;
    }
    if (/GOCSPX-[A-Za-z0-9_-]{10,}/.test(content)) secretCount += 1;
  }
  if (secretCount > 0) failures.push(`${scope}에서 secret/service role credential 형태 ${secretCount}건 발견`);
}

function scanPii(files, markers, scope) {
  let matchCount = 0;
  for (const file of files) {
    const content = getFileContent(file);
    if (markers.some((marker) => content.includes(marker.value))) matchCount += 1;
  }
  if (matchCount > 0) failures.push(`${scope}에서 PII marker 포함 파일 ${matchCount}개 발견`);
}

function getFileContent(file) {
  if (typeof file === "string") return readFileSync(file, "utf8");
  return typeof file.content === "string" ? file.content : readFileSync(file.path, "utf8");
}

function loadPiiMarkersFromWorkingTree() {
  const markerPath = join(root, "scripts/pii-markers.local.txt");
  if (!existsSync(markerPath)) return [];
  return readFileSync(markerPath, "utf8")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && !value.startsWith("#"))
    .map((value) => ({ field: "local marker", value }));
}

function loadPiiMarkersFromHistory(blobs) {
  const markers = [];
  for (const blob of blobs.filter((item) => /(^|\/)seedMembers\.json$/i.test(item.path))) {
    try {
      const records = JSON.parse(blob.content);
      for (const record of records) {
        for (const field of piiFields) {
          const value = typeof record[field] === "string" ? record[field].trim() : "";
          const minimumLength = ["name", "nickname", "sponsorNameRaw"].includes(field) ? 3 : 7;
          if (value.length >= minimumLength) markers.push({ field, value });
        }
      }
    } catch {
      // seedMembers.json이 JSON이 아니면 PII marker baseline으로 사용하지 않는다.
    }
  }
  return deduplicateMarkers(markers);
}

function loadGitTextBlobs() {
  let objectList;
  try {
    objectList = git(["rev-list", "--objects", "--all"]);
  } catch {
    return [];
  }

  const objects = [];
  const seen = new Set();
  for (const line of objectList.split(/\r?\n/).filter(Boolean)) {
    const [oid, ...pathParts] = line.split(" ");
    const path = pathParts.join(" ");
    if (!oid || !path || seen.has(oid) || !isTextFile(path) || path.endsWith(".psd")) continue;
    seen.add(oid);
    objects.push({ oid, path });
  }
  if (objects.length === 0) return [];

  const blobs = [];
  const batchSize = 128;
  for (let start = 0; start < objects.length; start += batchSize) {
    const batch = objects.slice(start, start + batchSize);
    try {
      const output = execFileSync("git", ["cat-file", "--batch"], {
        cwd: root,
        input: `${batch.map((object) => object.oid).join("\n")}\n`,
        maxBuffer: 64 * 1024 * 1024
      });
      let offset = 0;
      for (const object of batch) {
        const headerEnd = output.indexOf(10, offset);
        if (headerEnd < 0) break;
        const header = output.subarray(offset, headerEnd).toString("utf8").split(" ");
        offset = headerEnd + 1;
        if (header[1] !== "blob") continue;
        const size = Number(header[2]);
        if (!Number.isFinite(size) || size > 8 * 1024 * 1024) {
          offset += Math.max(size, 0) + 1;
          continue;
        }
        const content = output.subarray(offset, offset + size).toString("utf8");
        offset += size + 1;
        blobs.push({ path: object.path, content });
      }
    } catch {
      return [];
    }
  }
  return blobs;
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
    const payload = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

function readText(path) {
  const fullPath = join(root, path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function walk(directory, ignoredNames) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (ignoredNames.has(entry)) continue;
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) files.push(...walk(path, ignoredNames));
    else files.push(path);
  }
  return files;
}

function isTextFile(path) {
  return textExtensions.has(extname(path).toLowerCase());
}
