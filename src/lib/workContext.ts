import type { MainFilter } from "../types";

const WORK_CONTEXT_KEY = "ngmembers.work-context.v1";
export const WORK_CONTEXT_TTL_MS = 30 * 60 * 1000;

export interface MemberWorkContext {
  version: 1;
  savedAt: number;
  filter: MainFilter;
  activeMemberId: string | null;
  editorMemberId: string | null;
  newMemberEditorOpen: boolean;
  scrollY: number;
}

export function readMemberWorkContext(
  now = Date.now()
): MemberWorkContext | null {
  try {
    const raw = window.localStorage.getItem(WORK_CONTEXT_KEY);
    if (!raw) return null;

    const context = parseMemberWorkContext(raw, now);
    if (!context) window.localStorage.removeItem(WORK_CONTEXT_KEY);
    return context;
  } catch {
    return null;
  }
}

export function writeMemberWorkContext(
  context: Omit<MemberWorkContext, "version" | "savedAt">,
  now = Date.now()
): void {
  try {
    window.localStorage.setItem(
      WORK_CONTEXT_KEY,
      JSON.stringify({ version: 1, savedAt: now, ...context })
    );
  } catch {
    // 저장소가 차단되거나 가득 찬 경우에도 앱 사용은 계속합니다.
  }
}

export function clearMemberWorkContext(): void {
  try {
    window.localStorage.removeItem(WORK_CONTEXT_KEY);
  } catch {
    // 저장소가 차단된 환경에서도 로그아웃과 화면 초기화를 계속합니다.
  }
}

export function parseMemberWorkContext(
  raw: string,
  now = Date.now()
): MemberWorkContext | null {
  try {
    const value = JSON.parse(raw) as Partial<MemberWorkContext>;
    if (
      value.version !== 1 ||
      typeof value.savedAt !== "number" ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt > now ||
      now - value.savedAt > WORK_CONTEXT_TTL_MS ||
      !isMainFilter(value.filter) ||
      !isNullableId(value.activeMemberId) ||
      !isNullableId(value.editorMemberId) ||
      (value.newMemberEditorOpen !== undefined &&
        typeof value.newMemberEditorOpen !== "boolean") ||
      typeof value.scrollY !== "number" ||
      !Number.isFinite(value.scrollY) ||
      value.scrollY < 0
    ) {
      return null;
    }

    return {
      version: 1,
      savedAt: value.savedAt,
      filter: value.filter,
      activeMemberId: value.activeMemberId,
      editorMemberId: value.editorMemberId,
      newMemberEditorOpen: value.newMemberEditorOpen ?? false,
      scrollY: value.scrollY
    };
  } catch {
    return null;
  }
}

function isMainFilter(value: unknown): value is MainFilter {
  return value === "all" || value === "anchor" || value === "favorite";
}

function isNullableId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && value.length > 0 && value.length <= 128)
  );
}
