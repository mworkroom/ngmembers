import { demoMembers } from "../data/demoMembers";
import type { MemberRecord } from "../types";

const LEGACY_STORAGE_KEY = "nangok-member-mvp-v1";
const STORAGE_KEY = "nangok-member-phase1-demo-v1";
const STORAGE_VERSION = 1;

interface StoredPayload {
  version: number;
  members: MemberRecord[];
}

export function getSeedMembers(): MemberRecord[] {
  return structuredClone(demoMembers);
}

export function loadMembers(): MemberRecord[] {
  clearLegacyMemberData();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getSeedMembers();
    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.members)) {
      return getSeedMembers();
    }
    return parsed.members;
  } catch {
    return getSeedMembers();
  }
}

export function saveMembers(members: MemberRecord[]): void {
  try {
    const payload: StoredPayload = {
      version: STORAGE_VERSION,
      members
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 파일 미리보기나 브라우저 보안 설정에서 저장소가 막혀도 앱은 계속 동작합니다.
  }
}

export function clearStoredMembers(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 사용할 수 없는 환경에서는 초기 메모리 데이터만 교체합니다.
  }
}

function clearLegacyMemberData(): void {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // 저장소 접근이 차단된 환경에서도 앱 시작을 막지 않습니다.
  }
}
