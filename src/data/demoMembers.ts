import type { MemberRecord } from "../types";

// Phase 1에서는 실제 회원정보를 번들에 넣지 않습니다.
// 이 fixture는 로그인 후 기존 UI가 정상 렌더링되는지만 확인하기 위한 가상 데이터입니다.
export const demoMembers: MemberRecord[] = [
  {
    id: "demo-alpha",
    memberNumber: "1001",
    name: "Demo Member Alpha",
    nickname: "테스트 알파",
    isAnchorMember: true,
    isFavorite: true,
    sponsorNameRaw: "",
    affiliationId: null,
    side: null,
    directParentId: null,
    directParentSide: null,
    birthDate: "",
    phone: "",
    countryCode: "XX",
    cpf: "",
    notes: "개인정보가 아닌 Phase 1 가상 회원",
    status: "active",
    isHidden: false,
    importWarnings: []
  },
  {
    id: "demo-beta",
    memberNumber: "1002",
    name: "Demo Member Beta",
    nickname: "테스트 베타",
    isAnchorMember: false,
    isFavorite: false,
    sponsorNameRaw: "테스트 알파",
    affiliationId: "demo-alpha",
    side: "left",
    directParentId: null,
    directParentSide: null,
    birthDate: "",
    phone: "",
    countryCode: "XX",
    cpf: "",
    notes: "",
    status: "active",
    isHidden: false,
    importWarnings: []
  },
  {
    id: "demo-gamma",
    memberNumber: "1003",
    name: "Demo Member Gamma",
    nickname: "테스트 감마",
    isAnchorMember: false,
    isFavorite: true,
    sponsorNameRaw: "테스트 알파",
    affiliationId: "demo-alpha",
    side: "right",
    directParentId: "demo-alpha",
    directParentSide: "right",
    birthDate: "",
    phone: "",
    countryCode: "XX",
    cpf: "",
    notes: "",
    status: "review",
    isHidden: false,
    importWarnings: []
  }
];
