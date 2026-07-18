import assert from "node:assert/strict";
import test from "node:test";
import { fakeMemberRow } from "../../test-fixtures/members";
import {
  MemberMappingError,
  memberFormToInsert,
  memberFormToUpdate,
  memberFromRow
} from "../memberMapper";
import {
  loadAllMemberRows,
  MemberConflictError,
  MemberRepositoryError,
  requireMutationRow,
  toMemberRepositoryError,
  type MemberPageFetcher
} from "../memberRepository";
import type { MemberFormState } from "../../types";

test("DB row를 앱 record로 모든 필드 변환한다", () => {
  const row = fakeMemberRow(1, {
    member_number: "12345",
    name: "가상 가입명",
    nickname: "가상별명",
    is_anchor_member: true,
    is_favorite: true,
    sponsor_name_raw: "가상 스폰서",
    affiliation_id: "40000000-0000-5000-8000-000000000002",
    side: "left",
    direct_parent_id: "40000000-0000-5000-8000-000000000003",
    direct_parent_side: "right",
    birth_date: "1999-12-31",
    phone: "01012345678",
    country_code: "KR",
    cpf: "12345678901",
    notes: "가상 메모",
    member_status: "review",
    is_hidden: true
  });

  assert.deepEqual(memberFromRow(row), {
    id: row.id,
    memberNumber: "12345",
    name: "가상 가입명",
    nickname: "가상별명",
    isAnchorMember: true,
    isFavorite: true,
    sponsorNameRaw: "가상 스폰서",
    affiliationId: "40000000-0000-5000-8000-000000000002",
    side: "left",
    directParentId: "40000000-0000-5000-8000-000000000003",
    directParentSide: "right",
    birthDate: "19991231",
    phone: "01012345678",
    countryCode: "KR",
    cpf: "12345678901",
    notes: "가상 메모",
    status: "review",
    isHidden: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
});

test("nullable text와 날짜를 빈 문자열로 읽고 다시 NULL로 쓴다", () => {
  const record = memberFromRow(fakeMemberRow(2, {
    member_number: null,
    name: null,
    nickname: null,
    birth_date: null
  }));
  assert.equal(record.memberNumber, "");
  assert.equal(record.name, "");
  assert.equal(record.nickname, "");
  assert.equal(record.birthDate, "");

  const payload = memberFormToInsert(fakeForm({
    memberNumber: "  ",
    name: "  ",
    birthDate: "",
    countryCode: ""
  }));
  assert.equal(payload.member_number, null);
  assert.equal(payload.name, null);
  assert.equal(payload.birth_date, null);
  assert.equal(payload.country_code, null);
  assert.equal(payload.is_hidden, false);
});

test("쓰기 mapper가 날짜·국가·enum을 정규화한다", () => {
  const payload = memberFormToUpdate(fakeForm({
    memberNumber: " 123456 ",
    name: " 가상 이름 ",
    birthDate: "20000229",
    countryCode: " br ",
    side: "left",
    directParentSide: "right",
    status: "withdrawn"
  }));
  assert.equal(payload.member_number, "123456");
  assert.equal(payload.name, "가상 이름");
  assert.equal(payload.birth_date, "2000-02-29");
  assert.equal(payload.country_code, "BR");
  assert.equal(payload.side, "left");
  assert.equal(payload.direct_parent_side, "right");
  assert.equal(payload.member_status, "withdrawn");
});

test("잘못된 날짜와 DB enum은 조용히 기본값으로 바꾸지 않는다", () => {
  assert.throws(
    () => memberFormToUpdate(fakeForm({ birthDate: "20230229" })),
    MemberMappingError
  );
  assert.throws(
    () => memberFromRow(fakeMemberRow(3, { side: "center" })),
    MemberMappingError
  );
  assert.throws(
    () => memberFromRow(fakeMemberRow(4, { member_status: "unknown" })),
    MemberMappingError
  );
});

test("500/500/378 UUID cursor page를 count와 일치하게 결합한다", async () => {
  const allRows = Array.from({ length: 1378 }, (_, index) => fakeMemberRow(index + 1));
  const cursors: Array<string | null> = [];
  const fetchPage: MemberPageFetcher = async (cursor, includeCount) => {
    cursors.push(cursor);
    const start = cursor
      ? allRows.findIndex((row) => row.id === cursor) + 1
      : 0;
    return {
      rows: allRows.slice(start, start + 500),
      count: includeCount ? allRows.length : null
    };
  };

  const rows = await loadAllMemberRows(fetchPage);
  assert.equal(rows.length, 1378);
  assert.deepEqual(cursors, [null, allRows[499].id, allRows[999].id]);
});

test("중복 ID·cursor 정체·중간 실패를 부분 성공으로 처리하지 않는다", async () => {
  const first = fakeMemberRow(1);
  const second = fakeMemberRow(2);
  let call = 0;
  await assert.rejects(
    loadAllMemberRows(async () => {
      call += 1;
      return call === 1
        ? { rows: [first, second], count: 3 }
        : { rows: [second], count: null };
    }, 2),
    MemberRepositoryError
  );

  call = 0;
  await assert.rejects(
    loadAllMemberRows(async () => {
      call += 1;
      return call === 1
        ? { rows: [second], count: 2 }
        : { rows: [first], count: null };
    }, 1),
    MemberRepositoryError
  );

  await assert.rejects(
    loadAllMemberRows(async () => {
      throw new Error("가짜 중간 요청 실패");
    }),
    /가짜 중간 요청 실패/
  );
});

test("updated_at 조건에서 반환 행이 없으면 conflict로 분류한다", () => {
  assert.throws(() => requireMutationRow(null), MemberConflictError);
  assert.equal(requireMutationRow(fakeMemberRow(5)).id, fakeMemberRow(5).id);
});

test("Postgres 오류 코드를 개인정보 없는 사용자 범주로 변환한다", () => {
  assert.equal(toMemberRepositoryError({ code: "23505" }).kind, "duplicate");
  assert.equal(toMemberRepositoryError({ code: "23503" }).kind, "relation");
  assert.equal(toMemberRepositoryError({ code: "23514" }).kind, "check");
  assert.equal(toMemberRepositoryError({ code: "42501" }).kind, "permission");
  assert.equal(
    toMemberRepositoryError({ message: "Failed to fetch" }).kind,
    "network"
  );
});

function fakeForm(overrides: Partial<MemberFormState> = {}): MemberFormState {
  return {
    memberNumber: "900000001",
    name: "가상 회원",
    nickname: "가상별명",
    isAnchorMember: false,
    isFavorite: false,
    affiliationId: null,
    sponsorNameRaw: "",
    side: null,
    directParentId: null,
    directParentSide: null,
    birthDate: "",
    phone: "",
    countryCode: "",
    cpf: "",
    notes: "",
    status: "active",
    ...overrides
  };
}
