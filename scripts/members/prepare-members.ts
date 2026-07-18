import { resolve } from "node:path";
import { flagPath, parseCliArgs } from "./lib/cli";
import { safeErrorCode } from "./lib/errors";
import { prepareMembers } from "./lib/prepared";
import { compactValidationSummary } from "./lib/reports";

const args = parseCliArgs(process.argv.slice(2));
const sourcePath = args.positionals[0] ? resolve(args.positionals[0]) : null;
const reportDirectory = flagPath(args, "report-dir") ?? resolve("reports/phase2");
const correctionsPath =
  flagPath(args, "corrections") ?? resolve(reportDirectory, "corrections.local.json");

if (!sourcePath) {
  console.error(
    "사용법: npm run members:prepare -- <CSV> [--corrections <manifest>] [--report-dir <dir>]"
  );
  process.exit(2);
}

try {
  const result = await prepareMembers({
    sourcePath,
    correctionsPath,
    reportDirectory
  });
  console.log(
    JSON.stringify(
      {
        ...compactValidationSummary(result.validation),
        preparedSha256: result.payload.preparedSha256,
        expectedInsertCount: result.payload.rowCount,
        expectedRelationCount: result.payload.summary.relationCount
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(`Phase 2 preparation blocked: ${safeErrorCode(error)}`);
  process.exitCode = 1;
}
