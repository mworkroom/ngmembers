const NEW_MEMBER_DRAFT_KEY = "ngmembers.new-member-draft.v1";
export const NEW_MEMBER_DRAFT_TTL_MS = 30 * 60 * 1000;

export interface NewMemberDraft {
  version: 1;
  savedAt: number;
  memberNumber: string;
  name: string;
}

export function readNewMemberDraft(now = Date.now()): NewMemberDraft | null {
  try {
    const raw = window.sessionStorage.getItem(NEW_MEMBER_DRAFT_KEY);
    if (!raw) return null;

    const draft = parseNewMemberDraft(raw, now);
    if (!draft) window.sessionStorage.removeItem(NEW_MEMBER_DRAFT_KEY);
    return draft;
  } catch {
    return null;
  }
}

export function writeNewMemberDraft(
  draft: Pick<NewMemberDraft, "memberNumber" | "name">,
  now = Date.now()
): void {
  try {
    window.sessionStorage.setItem(
      NEW_MEMBER_DRAFT_KEY,
      JSON.stringify({ version: 1, savedAt: now, ...draft })
    );
  } catch {
    // 임시 저장소가 차단된 환경에서도 입력과 저장은 계속합니다.
  }
}

export function clearNewMemberDraft(): void {
  try {
    window.sessionStorage.removeItem(NEW_MEMBER_DRAFT_KEY);
  } catch {
    // 저장소가 차단된 환경에서도 닫기와 로그아웃은 계속합니다.
  }
}

export function parseNewMemberDraft(
  raw: string,
  now = Date.now()
): NewMemberDraft | null {
  try {
    const value = JSON.parse(raw) as Partial<NewMemberDraft>;
    if (
      value.version !== 1 ||
      typeof value.savedAt !== "number" ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt > now ||
      now - value.savedAt > NEW_MEMBER_DRAFT_TTL_MS ||
      typeof value.memberNumber !== "string" ||
      value.memberNumber.length > 24 ||
      !/^\d*$/.test(value.memberNumber) ||
      typeof value.name !== "string" ||
      value.name.length > 200
    ) {
      return null;
    }

    return {
      version: 1,
      savedAt: value.savedAt,
      memberNumber: value.memberNumber,
      name: value.name
    };
  } catch {
    return null;
  }
}
