import type { MemberRow } from "../lib/memberMapper";

export function fakeMemberRow(
  index: number,
  overrides: Partial<MemberRow> = {}
): MemberRow {
  const suffix = String(index).padStart(12, "0");
  return {
    id: `40000000-0000-5000-8000-${suffix}`,
    member_number: String(900000000 + index),
    name: `가상 회원 ${index}`,
    nickname: `가상별명${index}`,
    is_anchor_member: false,
    is_favorite: false,
    sponsor_name_raw: null,
    affiliation_id: null,
    side: null,
    direct_parent_id: null,
    direct_parent_side: null,
    birth_date: null,
    phone: null,
    country_code: null,
    cpf: null,
    notes: null,
    member_status: "active",
    is_hidden: false,
    created_at: "2026-07-18T00:00:00.000Z",
    updated_at: "2026-07-18T00:00:00.000Z",
    ...overrides
  };
}
