import type { PostgrestError } from "@supabase/supabase-js";
import type { MemberFormState, MemberRecord } from "../types";
import { supabase, supabaseConfigError } from "./supabase";
import {
  memberFormToInsert,
  memberFormToUpdate,
  memberFromRow,
  type MemberRow
} from "./memberMapper";

export const MEMBER_PAGE_SIZE = 500;

const MEMBER_COLUMNS = [
  "id",
  "member_number",
  "name",
  "nickname",
  "is_anchor_member",
  "is_favorite",
  "sponsor_name_raw",
  "affiliation_id",
  "side",
  "direct_parent_id",
  "direct_parent_side",
  "birth_date",
  "phone",
  "country_code",
  "cpf",
  "notes",
  "member_status",
  "is_hidden",
  "created_at",
  "updated_at"
].join(",") as "id,member_number,name,nickname,is_anchor_member,is_favorite,sponsor_name_raw,affiliation_id,side,direct_parent_id,direct_parent_side,birth_date,phone,country_code,cpf,notes,member_status,is_hidden,created_at,updated_at";

export type MemberErrorKind =
  | "duplicate"
  | "relation"
  | "check"
  | "permission"
  | "network"
  | "unknown";

export class MemberRepositoryError extends Error {
  constructor(
    public readonly kind: MemberErrorKind,
    public readonly code: string | null
  ) {
    super(memberErrorMessage(kind));
    this.name = "MemberRepositoryError";
  }
}

export class MemberConflictError extends Error {
  constructor() {
    super("다른 화면에서 변경되어 최신 정보를 불러왔습니다. 내용을 다시 확인해주세요.");
    this.name = "MemberConflictError";
  }
}

export interface MemberPage {
  rows: MemberRow[];
  count: number | null;
}

export type MemberPageFetcher = (
  cursor: string | null,
  includeCount: boolean
) => Promise<MemberPage>;

export async function listMembers(): Promise<MemberRecord[]> {
  return (await loadAllMemberRows(fetchMemberPage)).map(memberFromRow);
}

export async function createMember(input: MemberFormState): Promise<MemberRecord> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("members")
    .insert(memberFormToInsert(input))
    .select(MEMBER_COLUMNS)
    .single();

  if (error) throw toMemberRepositoryError(error);
  return memberFromRow(data);
}

export async function updateMember(
  id: string,
  expectedUpdatedAt: string,
  input: MemberFormState
): Promise<MemberRecord> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("members")
    .update(memberFormToUpdate(input))
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select(MEMBER_COLUMNS)
    .maybeSingle();

  if (error) throw toMemberRepositoryError(error);
  return memberFromRow(requireMutationRow(data));
}

export async function hideMember(
  id: string,
  expectedUpdatedAt: string
): Promise<MemberRecord> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("members")
    .update({ is_hidden: true })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select(MEMBER_COLUMNS)
    .maybeSingle();

  if (error) throw toMemberRepositoryError(error);
  return memberFromRow(requireMutationRow(data));
}

export async function loadAllMemberRows(
  fetchPage: MemberPageFetcher,
  pageSize = MEMBER_PAGE_SIZE
): Promise<MemberRow[]> {
  const rows: MemberRow[] = [];
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  let expectedCount: number | null = null;

  while (true) {
    const page = await fetchPage(cursor, expectedCount === null);
    if (expectedCount === null) {
      if (page.count === null || !Number.isSafeInteger(page.count) || page.count < 0) {
        throw new MemberRepositoryError("unknown", null);
      }
      expectedCount = page.count;
    }

    if (page.rows.length === 0) {
      if (rows.length === expectedCount) break;
      throw new MemberRepositoryError("unknown", null);
    }

    for (const row of page.rows) {
      if (seenIds.has(row.id)) throw new MemberRepositoryError("unknown", null);
      seenIds.add(row.id);
      rows.push(row);
    }

    const nextCursor = page.rows[page.rows.length - 1]?.id ?? null;
    if (!nextCursor || (cursor !== null && nextCursor <= cursor)) {
      throw new MemberRepositoryError("unknown", null);
    }
    cursor = nextCursor;

    if (rows.length === expectedCount) break;
    if (rows.length > expectedCount || page.rows.length < pageSize) {
      throw new MemberRepositoryError("unknown", null);
    }
  }

  if (rows.length !== expectedCount || seenIds.size !== expectedCount) {
    throw new MemberRepositoryError("unknown", null);
  }

  return rows;
}

export function requireMutationRow(row: MemberRow | null): MemberRow {
  if (!row) throw new MemberConflictError();
  return row;
}

export function toMemberRepositoryError(error: unknown): MemberRepositoryError {
  const candidate = error as Partial<PostgrestError> | null;
  const code = typeof candidate?.code === "string" ? candidate.code : null;
  if (code === "23505") return new MemberRepositoryError("duplicate", code);
  if (code === "23503") return new MemberRepositoryError("relation", code);
  if (code === "23514") return new MemberRepositoryError("check", code);
  if (code === "42501") return new MemberRepositoryError("permission", code);

  const message = typeof candidate?.message === "string" ? candidate.message : "";
  if (/fetch|network|timeout|connection|failed/i.test(message)) {
    return new MemberRepositoryError("network", code);
  }
  return new MemberRepositoryError("unknown", code);
}

export function memberErrorMessage(kind: MemberErrorKind): string {
  if (kind === "duplicate") return "같은 회원번호가 이미 있습니다.";
  if (kind === "relation") return "선택한 관계 대상이 변경되었습니다. 새로고침 후 다시 확인해주세요.";
  if (kind === "check") return "입력 형식 또는 회원 관계를 확인해주세요.";
  if (kind === "permission") return "회원 데이터 권한을 확인하지 못했습니다. 다시 로그인해주세요.";
  if (kind === "network") return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
  return "회원 데이터를 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

async function fetchMemberPage(
  cursor: string | null,
  includeCount: boolean
): Promise<MemberPage> {
  const client = requireSupabase();
  let query = client
    .from("members")
    .select(MEMBER_COLUMNS, includeCount ? { count: "exact" } : {})
    .order("id", { ascending: true })
    .limit(MEMBER_PAGE_SIZE);

  if (cursor !== null) query = query.gt("id", cursor);
  const { data, error, count } = await query;
  if (error) throw toMemberRepositoryError(error);
  return { rows: data, count };
}

function requireSupabase() {
  if (!supabase) {
    throw new MemberRepositoryError("unknown", null);
  }
  return supabase;
}

export function getMemberLoadErrorMessage(error: unknown): string {
  if (error instanceof MemberRepositoryError) return error.message;
  if (supabaseConfigError) return supabaseConfigError;
  return "회원 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
}
