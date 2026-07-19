export const labels = {
  app: {
    title: "회원 계보 찾기"
  },
  search: {
    placeholder: "이름·닉네임·회원번호·메모·전화번호",
    ariaLabel: "회원 검색",
    clearAriaLabel: "검색어 지우기",
    emptyTitle: "검색 결과가 없습니다.",
    emptyDescription: "이름·닉네임·회원번호·메모·전화번호를 다시 확인해주세요."
  },
  filters: {
    ariaLabel: "회원 목록 필터",
    all: "전체",
    anchor: "주요 사업자",
    favorite: "관심 회원"
  },
  member: {
    badgesAriaLabel: "회원 표시",
    anchor: "주요 사업자",
    favorite: "관심 회원",
    withdrawn: "탈퇴",
    review: "확인 필요",
    birthDate: "생년월일",
    phone: "전화번호",
    cpf: "CPF",
    country: "국가",
    countryUnknown: "국가 미확인",
    notes: "메모"
  },
  editor: {
    country: "국가",
    nicknamePlaceholder: "한국어 두 글자 이상 포함",
    countryOptions: [
      { value: "", label: "국가 선택" },
      { value: "KR", label: "한국" },
      { value: "BR", label: "브라질" },
      { value: "MX", label: "멕시코" },
      { value: "XX", label: "글로벌" }
    ]
  },
  validation: {
    nickname: "닉네임은 한국어 두 글자 이상 포함해주세요."
  }
} as const;
