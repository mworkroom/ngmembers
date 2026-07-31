import assert from "node:assert/strict";
import test from "node:test";
import { labels } from "../../content/labels";
import type { MemberRecord } from "../../types";
import {
  countryLabel,
  countryBadgeTone,
  formatMemberSubline,
  formatNotesPreview,
  isValidNickname,
  normalizeSearch,
  toPersonNameTitleCase
} from "../../utils/formatters";
import {
  getSearchRank,
  isExactMemberNumberMatch
} from "../../utils/memberSearch";
import {
  NEW_MEMBER_DRAFT_TTL_MS,
  parseNewMemberDraft
} from "../newMemberDraft";
import {
  parseMemberWorkContext,
  WORK_CONTEXT_TTL_MS
} from "../workContext";

test("주요 사용자 문구와 국가 선택지를 한 모듈에서 제공한다", () => {
  assert.equal(labels.filters.anchor, "주요 사업자");
  assert.equal(labels.search.placeholder, "이름·닉네임·회원번호·메모·전화번호");
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

test("새 회원 이름 입력을 공백과 대소문자에 관계없이 Title Case로 정리한다", () => {
  assert.equal(toPersonNameTitleCase("  MARIA   DA SILVA "), "Maria Da Silva");
  assert.equal(toPersonNameTitleCase("mArIA dA siLVA"), "Maria Da Silva");
  assert.equal(
    toPersonNameTitleCase("ANA-MARIA D'ÁVILA O’CONNOR"),
    "Ana-Maria D'Ávila O’Connor"
  );
  assert.equal(toPersonNameTitleCase("JOÃO DA SILVA"), "João Da Silva");
  assert.equal(toPersonNameTitleCase("홍길동"), "홍길동");
});

test("접힌 카드 요약은 코드, 펼친 카드 본문은 국가명으로 표시한다", () => {
  assert.equal(countryLabel("xx", true), "XX");
  assert.equal(countryLabel("BR", true), "BR");
  assert.equal(countryLabel("BR"), "브라질");
  assert.equal(countryLabel("KR"), "한국");
  assert.equal(countryLabel("XX"), "글로벌");
  assert.equal(countryLabel(""), "국가 미확인");
  assert.deepEqual(formatMemberSubline(fakeMember({ countryCode: "XX" })), [
    "별명",
    "10001",
    "XX"
  ]);
});

test("국가 코드 badge 색상 그룹을 국가별로 분류한다", () => {
  assert.equal(countryBadgeTone("BR"), "brazil");
  assert.equal(countryBadgeTone("KR"), "korea");
  assert.equal(countryBadgeTone("MX"), "other");
  assert.equal(countryBadgeTone("XX"), "other");
});

test("작업 컨텍스트는 30분 동안 최소 화면 상태만 복원한다", () => {
  const now = Date.UTC(2026, 6, 31, 3, 0, 0);
  const context = {
    version: 1,
    savedAt: now - WORK_CONTEXT_TTL_MS,
    filter: "favorite",
    activeMemberId: "40000000-0000-5000-8000-000000000001",
    editorMemberId: "40000000-0000-5000-8000-000000000001",
    newMemberEditorOpen: false,
    scrollY: 320,
    notes: "복원하면 안 되는 값"
  };

  assert.deepEqual(parseMemberWorkContext(JSON.stringify(context), now), {
    version: 1,
    savedAt: now - WORK_CONTEXT_TTL_MS,
    filter: "favorite",
    activeMemberId: "40000000-0000-5000-8000-000000000001",
    editorMemberId: "40000000-0000-5000-8000-000000000001",
    newMemberEditorOpen: false,
    scrollY: 320
  });
  assert.equal(
    parseMemberWorkContext(
      JSON.stringify({ ...context, savedAt: now - WORK_CONTEXT_TTL_MS - 1 }),
      now
    ),
    null
  );
});

test("작업 컨텍스트는 손상되거나 허용되지 않은 값을 복원하지 않는다", () => {
  const now = Date.UTC(2026, 6, 31, 3, 0, 0);
  assert.equal(parseMemberWorkContext("not-json", now), null);
  assert.equal(
    parseMemberWorkContext(
      JSON.stringify({
        version: 1,
        savedAt: now,
        filter: "unknown",
        activeMemberId: null,
        editorMemberId: null,
        newMemberEditorOpen: false,
        scrollY: 0
      }),
      now
    ),
    null
  );
});

test("새 회원 추가창과 이름·회원번호 초안은 30분 동안 복원한다", () => {
  const now = Date.UTC(2026, 7, 1, 3, 0, 0);
  const draft = {
    version: 1,
    savedAt: now - NEW_MEMBER_DRAFT_TTL_MS,
    memberNumber: "12345678",
    name: "Hong Gil Dong"
  };

  assert.deepEqual(parseNewMemberDraft(JSON.stringify(draft), now), draft);
  assert.equal(
    parseNewMemberDraft(
      JSON.stringify({ ...draft, savedAt: now - NEW_MEMBER_DRAFT_TTL_MS - 1 }),
      now
    ),
    null
  );
  assert.equal(
    parseNewMemberDraft(JSON.stringify({ ...draft, memberNumber: "12A" }), now),
    null
  );
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
