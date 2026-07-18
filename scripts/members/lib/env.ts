import { readFile } from "node:fs/promises";

export interface ImportEnvironment {
  supabaseUrl: string;
  serviceRoleKey: string;
  expectedProjectRef: string;
}

export async function loadImportEnvironment(
  localPath: string
): Promise<ImportEnvironment | null> {
  const fileValues = new Map<string, string>();
  try {
    const content = await readFile(localPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = stripQuotes(line.slice(separator + 1).trim());
      fileValues.set(key, value);
    }
  } catch {
    // Dry-run can remain offline. Apply mode checks for a complete environment.
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? fileValues.get("SUPABASE_URL") ?? "";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    fileValues.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";
  const expectedProjectRef =
    process.env.EXPECTED_SUPABASE_PROJECT_REF ??
    fileValues.get("EXPECTED_SUPABASE_PROJECT_REF") ??
    "";

  if (!supabaseUrl || !serviceRoleKey || !expectedProjectRef) return null;
  return { supabaseUrl, serviceRoleKey, expectedProjectRef };
}

export function projectRefFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isServiceRoleCredential(value: string): boolean {
  if (value.startsWith("sb_secret_") && value.length > "sb_secret_".length) return true;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as {
      role?: unknown;
    };
    return decoded.role === "service_role";
  } catch {
    return false;
  }
}

function stripQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
