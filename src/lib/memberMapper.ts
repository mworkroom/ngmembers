import type { MemberFormState, MemberRecord, MemberSide, MemberStatus } from "../types";
import type { Tables, TablesInsert, TablesUpdate } from "../types/database";

export type MemberRow = Tables<"members">;
export type MemberInsert = TablesInsert<"members">;
export type MemberUpdate = TablesUpdate<"members">;

const MEMBER_STATUSES = new Set<MemberStatus>(["active", "withdrawn", "review"]);
const MEMBER_SIDES = new Set<Exclude<MemberSide, null>>(["left", "right"]);

export class MemberMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberMappingError";
  }
}

export function memberFromRow(row: MemberRow): MemberRecord {
  return {
    id: requireText(row.id, "id"),
    memberNumber: nullableText(row.member_number),
    name: nullableText(row.name),
    nickname: nullableText(row.nickname),
    isAnchorMember: row.is_anchor_member,
    isFavorite: row.is_favorite,
    sponsorNameRaw: nullableText(row.sponsor_name_raw),
    affiliationId: row.affiliation_id,
    side: readSide(row.side, "side"),
    directParentId: row.direct_parent_id,
    directParentSide: readSide(row.direct_parent_side, "direct_parent_side"),
    birthDate: readBirthDate(row.birth_date),
    phone: nullableText(row.phone),
    countryCode: readCountryCode(row.country_code),
    cpf: nullableText(row.cpf),
    notes: nullableText(row.notes),
    status: readStatus(row.member_status),
    isHidden: row.is_hidden,
    createdAt: requireTimestamp(row.created_at, "created_at"),
    updatedAt: requireTimestamp(row.updated_at, "updated_at")
  };
}

export function memberFormToInsert(state: MemberFormState): MemberInsert {
  return {
    ...memberFormToPayload(state),
    is_hidden: false
  };
}

export function memberFormToUpdate(state: MemberFormState): MemberUpdate {
  return memberFormToPayload(state);
}

function memberFormToPayload(state: MemberFormState): MemberUpdate {
  const memberNumber = nullableTrimmed(state.memberNumber);
  if (memberNumber && !/^\d+$/.test(memberNumber)) {
    throw new MemberMappingError("회원번호는 숫자만 입력할 수 있습니다.");
  }

  const countryCode = nullableTrimmed(state.countryCode)?.toUpperCase() ?? null;
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new MemberMappingError("국가 코드는 영문 두 글자로 입력해주세요.");
  }

  if (!MEMBER_STATUSES.has(state.status)) {
    throw new MemberMappingError("지원하지 않는 회원 상태입니다.");
  }

  assertSide(state.side, "소속 위치");
  assertSide(state.directParentSide, "직계 위치");

  return {
    member_number: memberNumber,
    name: nullableTrimmed(state.name),
    nickname: nullableTrimmed(state.nickname),
    is_anchor_member: state.isAnchorMember,
    is_favorite: state.isFavorite,
    sponsor_name_raw: nullableTrimmed(state.sponsorNameRaw),
    affiliation_id: state.affiliationId,
    side: state.side,
    direct_parent_id: state.directParentId,
    direct_parent_side: state.directParentSide,
    birth_date: writeBirthDate(state.birthDate),
    phone: nullableTrimmed(state.phone),
    country_code: countryCode,
    cpf: nullableTrimmed(state.cpf),
    notes: nullableTrimmed(state.notes),
    member_status: state.status
  };
}

function readBirthDate(value: string | null): string {
  if (value === null) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isRealDate(value)) {
    throw new MemberMappingError("DB 생년월일 형식이 올바르지 않습니다.");
  }
  return value.replace(/-/g, "");
}

function writeBirthDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{8}$/.test(trimmed)) {
    throw new MemberMappingError("생년월일은 8자리 숫자로 입력해주세요.");
  }
  const iso = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  if (!isRealDate(iso)) {
    throw new MemberMappingError("존재하지 않는 생년월일입니다.");
  }
  return iso;
}

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

function readStatus(value: string): MemberStatus {
  if (MEMBER_STATUSES.has(value as MemberStatus)) return value as MemberStatus;
  throw new MemberMappingError("DB 회원 상태 값이 지원 범위를 벗어났습니다.");
}

function readSide(value: string | null, field: string): MemberSide {
  if (value === null) return null;
  if (MEMBER_SIDES.has(value as Exclude<MemberSide, null>)) {
    return value as Exclude<MemberSide, null>;
  }
  throw new MemberMappingError(`DB ${field} 값이 지원 범위를 벗어났습니다.`);
}

function assertSide(value: MemberSide, label: string): void {
  if (value !== null && !MEMBER_SIDES.has(value)) {
    throw new MemberMappingError(`${label} 값이 올바르지 않습니다.`);
  }
}

function readCountryCode(value: string | null): string {
  if (value === null) return "";
  if (!/^[A-Z]{2}$/.test(value)) {
    throw new MemberMappingError("DB 국가 코드 형식이 올바르지 않습니다.");
  }
  return value;
}

function requireTimestamp(value: string, field: string): string {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new MemberMappingError(`DB ${field} 값이 올바르지 않습니다.`);
  }
  return value;
}

function requireText(value: string, field: string): string {
  if (!value) throw new MemberMappingError(`DB ${field} 값이 비어 있습니다.`);
  return value;
}

function nullableText(value: string | null): string {
  return value ?? "";
}

function nullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}
