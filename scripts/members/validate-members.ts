import { join, resolve } from "node:path";
import {
  flagPath,
  hasFlag,
  parseCliArgs
} from "./lib/cli";
import { safeErrorCode } from "./lib/errors";
import {
  compactValidationSummary,
  initializeCorrectionsManifest,
  writeValidationReports
} from "./lib/reports";
import { validateMembers } from "./lib/validation";

const args = parseCliArgs(process.argv.slice(2));
const sourcePath = args.positionals[0] ? resolve(args.positionals[0]) : null;
const reportDirectory = flagPath(args, "report-dir") ?? resolve("reports/phase2");
const correctionsPath = flagPath(args, "corrections");

if (!sourcePath) {
  console.error(
    "사용법: npm run members:validate -- <CSV> [--corrections <manifest>] [--report-dir <dir>] [--init-corrections]"
  );
  process.exit(2);
}

try {
  const validation = await validateMembers({ sourcePath, correctionsPath });
  await writeValidationReports(validation, reportDirectory);

  if (hasFlag(args, "init-corrections")) {
    const manifestPath = correctionsPath ?? join(reportDirectory, "corrections.local.json");
    const result = await initializeCorrectionsManifest(
      manifestPath,
      validation.sourceSha256
    );
    console.log(`correctionsManifest=${result}`);
  }

  console.log(JSON.stringify(compactValidationSummary(validation), null, 2));
  if (validation.issues.some((entry) => entry.severity === "error")) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Phase 2 validation failed: ${safeErrorCode(error)}`);
  process.exitCode = 1;
}
