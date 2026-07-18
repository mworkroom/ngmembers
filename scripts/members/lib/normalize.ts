export const TRUE_VALUES = new Set(["true"]);
export const FALSE_VALUES = new Set(["false"]);

export function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function normalizeHumanText(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/gu, " ");
  return trimmed === "" ? null : trimmed;
}

export function normalizeRelationKey(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function parseBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function parseSide(value: string): "left" | "right" | null | undefined {
  const normalized = value.trim();
  if (normalized === "") return null;
  if (normalized === "좌") return "left";
  if (normalized === "우") return "right";
  return undefined;
}

export function parseMemberStatus(
  value: string
): "active" | "withdrawn" | "review" | null {
  const normalized = value.trim();
  if (normalized === "active" || normalized === "withdrawn" || normalized === "review") {
    return normalized;
  }
  return null;
}

export function parseBirthDate(value: string): string | null | undefined {
  const normalized = value.trim();
  if (normalized === "") return null;
  if (!/^\d{8}$/.test(normalized)) return undefined;

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  const day = Number(normalized.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
}

export function isCountryCode(value: string): boolean {
  const normalized = value.trim();
  return normalized === "" || /^[A-Z]{2}$/.test(normalized);
}

export function isSuspiciousCpf(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return (trimmed.match(/\d/g) ?? []).length !== 11;
}

export function isSuspiciousPhone(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  return digitCount < 7 || digitCount > 15;
}
