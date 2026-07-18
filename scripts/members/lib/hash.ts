import { createHash } from "node:crypto";

export function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function hashCanonicalJson(value: unknown): string {
  return sha256Text(canonicalJson(value));
}

export function deterministicMemberUuid(sourceSha256: string, sourceRow: number): string {
  const hex = sha256Text(`ngmembers-phase2:${sourceSha256}:${sourceRow}`).slice(0, 32);
  const chars = hex.split("");
  // RFC 9562 version 8 marks this as an application-defined deterministic UUID.
  chars[12] = "8";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const uuid = chars.join("");
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortValue(child)])
    );
  }
  return value;
}
