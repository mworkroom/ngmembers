import assert from "node:assert/strict";
import test from "node:test";
import { labels } from "../../content/labels";
import type { MemberRecord } from "../../types";
import {
  countryLabel,
  formatMemberSubline,
  formatNotesPreview,
  isValidNickname,
  normalizeSearch
} from "../../utils/formatters";
import {
  getSearchRank,
  isExactMemberNumberMatch
} from "../../utils/memberSearch";

test("주요 사용자 문구와 국가 선택지를 한 모듈에서 제공한다", () => {
  assert.equal(labels.filters.anchor, "주요 사업자");
  assert.equal(labels.search.placeholder, "이름·닉네임·회원번호·전화번호·메모");
  assert.deepEqual(
    labels.editor.countryOptions.map(({ value }) => value),
    ["", "KR", "BR", "MX", "XX"]
  );
});

test("메모를 기존 검색 필드보다 낮은 우선순위로 검색한다", () => {
  const member = fakeMember({
    nickname: "장미",
    notes: "교회 지인"
  });

  assert.equal(getSearchRank(member, "장미"), 1);
  assert.equal(getSearchRank(member, "교회"), 12);
  assert.equal(getSearchRank(member, "없는 메모"), 99);
});

test("자동 펼침은 정확한 회원번호 검색에만 적용한다", () => {
  const member = fakeMember({
    memberNumber: "12345",
    nickname: "12345별명",
    notes: "12345 메모"
  });

  assert.equal(isExactMemberNumberMatch(member, normalizeSearch("12345")), true);
  assert.equal(isExactMemberNumberMatch(member, normalizeSearch("12345별명")), false);
  assert.equal(isExactMemberNumberMatch(member, normalizeSearch("12345 메모")), false);
});

test("카드 메모는 공백을 정리해 열 글자까지만 미리 본다", () => {
  assert.equal(formatNotesPreview("  교회   지인  "), "교회 지인");
  assert.equal(formatNotesPreview("12345678901"), "1234567890…");
});

test("닉네임은 한국어 두 글자를 포함하면 다른 문자도 허용한다", () => {
  assert.equal(isValidNickname("엘리자베스 100"), true);
  assert.equal(isValidNickname("헐실라 hercilla"), true);
  assert.equal(isValidNickname("ab가나"), true);
  assert.equal(isValidNickname("hercilla"), false);
  assert.equal(isValidNickname("가"), false);
});

test("접힌 카드와 펼친 카드에서 국가를 영어 코드로 표시한다", () => {
  assert.equal(countryLabel("xx"), "XX");
  assert.equal(countryLabel("BR"), "BR");
  assert.equal(countryLabel(""), "국가 미확인");
  assert.deepEqual(formatMemberSubline(fakeMember({ countryCode: "XX" })), [
    "별명",
    "10001",
    "(XX)"
  ]);
});

function fakeMember(overrides: Partial<MemberRecord> = {}): MemberRecord {
  return {
    id: "40000000-0000-5000-8000-000000000001",
    memberNumber: "10001",
    name: "가입 이름",
    nickname: "별명",
    isAnchorMember: false,
    isFavorite: false,
    sponsorNameRaw: "",
    affiliationId: null,
    side: null,
    directParentId: null,
    directParentSide: null,
    birthDate: "",
    phone: "",
    countryCode: "BR",
    cpf: "",
    notes: "",
    status: "active",
    isHidden: false,
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides
  };
}
