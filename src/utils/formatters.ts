import type { MemberRecord, MemberSide, MemberStatus } from "../types";
import { labels } from "../content/labels";

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, "");
}

export function normalizeLooseText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .trim();
}

export function compareMemberNumbers(a: string, b: string): number {
  return a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" });
}

export function displayName(member: MemberRecord): string {
  return member.name || member.nickname || "이름 미확인";
}

export function countryLabel(code: string, compact = false): string {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return compact ? "" : labels.member.countryUnknown;
  if (compact) return normalized;
  return (
    labels.editor.countryOptions.find((option) => option.value === normalized)?.label ??
    normalized
  );
}

export function countryBadgeTone(code: string): "brazil" | "korea" | "other" {
  const normalized = code.trim().toUpperCase();
  if (normalized === "BR") return "brazil";
  if (normalized === "KR") return "korea";
  return "other";
}

export function statusLabel(status: MemberStatus): string {
  if (status === "withdrawn") return "탈퇴";
  if (status === "review") return "확인 필요";
  return "활동";
}

export function sideLabel(side: MemberSide): string {
  if (side === "left") return "좌";
  if (side === "right") return "우";
  return "위치 미확인";
}

export function formatBirthDate(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return value || "";

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return value;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;

  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)} · ${age}세`;
}

export function formatPhone(value: string, countryCode: string): string {
  const digits = onlyDigits(value);
  if (!digits) return "";
  const code = countryCode.trim().toUpperCase();

  if (code === "KR") {
    if (digits.length === 11 && digits.startsWith("010")) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10 && digits.startsWith("02")) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }

  if (code === "BR") {
    const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
    if (local.length === 11) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
  }

  if (code === "US") {
    const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (local.length === 10) {
      return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
    }
  }

  return digits;
}

export function formatCpf(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function isValidNickname(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const hangulCount = (trimmed.match(/[가-힣]/g) ?? []).length;
  const hasControlCharacter = /[\u0000-\u001F\u007F]/.test(trimmed);
  return hangulCount >= 2 && !hasControlCharacter;
}

export function formatMemberSubline(member: MemberRecord): string[] {
  const parts: string[] = [];
  if (member.nickname) parts.push(member.nickname);
  if (member.memberNumber) parts.push(member.memberNumber);
  const country = countryLabel(member.countryCode, true);
  if (country) parts.push(country);
  return parts;
}

export function formatNotesPreview(value: string, maxLength = 10): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

export function toMemberStatus(value: string): {
  status: MemberStatus;
  warning?: string;
} {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized === "active") return { status: "active" };
  if (normalized === "withdrawn") return { status: "withdrawn" };
  if (normalized === "review" || normalized === "unknown") {
    return { status: "review" };
  }
  return {
    status: "review",
    warning: normalized
      ? `원본 회원 상태 값 확인: ${value}`
      : "회원 상태가 비어 있음"
  };
}

export function toMemberSide(value: string): MemberSide {
  const normalized = value.trim().toLocaleLowerCase();
  if (["좌", "left", "l"].includes(normalized)) return "left";
  if (["우", "right", "r"].includes(normalized)) return "right";
  return null;
}

export function booleanFromText(value: string): boolean {
  return ["true", "1", "yes", "y"].includes(value.trim().toLocaleLowerCase());
}
