const LEGACY_MEMBER_STORAGE_KEYS = [
  "nangok-member-mvp-v1",
  "nangok-member-phase1-demo-v1"
] as const;

export function clearLegacyMemberStorage(): void {
  try {
    for (const key of LEGACY_MEMBER_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // 저장소가 차단된 환경에서도 서버 데이터 로딩을 계속합니다.
  }
}
