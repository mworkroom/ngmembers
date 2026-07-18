import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberFormState, MemberRecord } from "../types";
import {
  createMember as createMemberInRepository,
  getMemberLoadErrorMessage,
  hideMember as hideMemberInRepository,
  listMembers,
  MemberConflictError,
  MemberRepositoryError,
  updateMember as updateMemberInRepository,
  type MemberErrorKind
} from "../lib/memberRepository";

type MembersStatus = "loading" | "ready" | "error";

export type PendingMemberAction =
  | { kind: "create"; memberId: null }
  | { kind: "update" | "hide"; memberId: string };

export type MemberMutationResult =
  | { ok: true; member: MemberRecord }
  | {
      ok: false;
      kind: MemberErrorKind | "conflict" | "busy";
      message: string;
    };

interface UseMembersOptions {
  autoRefreshEnabled: boolean;
}

export interface MembersState {
  members: MemberRecord[];
  status: MembersStatus;
  errorMessage: string | null;
  isRefreshing: boolean;
  pendingAction: PendingMemberAction | null;
  retry: () => Promise<boolean>;
  refresh: () => Promise<boolean>;
  createMember: (input: MemberFormState) => Promise<MemberMutationResult>;
  updateMember: (
    id: string,
    expectedUpdatedAt: string,
    input: MemberFormState
  ) => Promise<MemberMutationResult>;
  hideMember: (id: string, expectedUpdatedAt: string) => Promise<MemberMutationResult>;
}

export function useMembers({ autoRefreshEnabled }: UseMembersOptions): MembersState {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [status, setStatus] = useState<MembersStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingMemberAction | null>(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const pendingRef = useRef<PendingMemberAction | null>(null);

  const load = useCallback(async (preserveCurrent: boolean): Promise<boolean> => {
    if (preserveCurrent && refreshInFlightRef.current) return false;
    if (preserveCurrent) {
      refreshInFlightRef.current = true;
      setIsRefreshing(true);
    } else {
      setStatus("loading");
    }
    setErrorMessage(null);
    const requestId = ++requestIdRef.current;

    try {
      const nextMembers = await listMembers();
      if (!mountedRef.current || requestId !== requestIdRef.current) return false;
      setMembers(nextMembers);
      setStatus("ready");
      return true;
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return false;
      if (!preserveCurrent) {
        setMembers([]);
        setStatus("error");
      }
      setErrorMessage(getMemberLoadErrorMessage(error));
      return false;
    } finally {
      if (preserveCurrent) {
        refreshInFlightRef.current = false;
        if (mountedRef.current && requestId === requestIdRef.current) {
          setIsRefreshing(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load(false);
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      pendingRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    if (!autoRefreshEnabled || status !== "ready") return;
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [autoRefreshEnabled, load, status]);

  const runMutation = useCallback(async (
    action: PendingMemberAction,
    operation: () => Promise<MemberRecord>,
    onSuccess: (member: MemberRecord) => void
  ): Promise<MemberMutationResult> => {
    if (pendingRef.current) {
      return { ok: false, kind: "busy", message: "진행 중인 저장을 먼저 완료해주세요." };
    }

    pendingRef.current = action;
    setPendingAction(action);
    try {
      const member = await operation();
      if (!mountedRef.current) {
        return { ok: false, kind: "unknown", message: "회원 화면이 닫혔습니다." };
      }
      onSuccess(member);
      return { ok: true, member };
    } catch (error) {
      if (error instanceof MemberConflictError) {
        await load(true);
        return { ok: false, kind: "conflict", message: error.message };
      }
      if (error instanceof MemberRepositoryError) {
        return { ok: false, kind: error.kind, message: error.message };
      }
      return {
        ok: false,
        kind: "unknown",
        message: "회원 데이터를 저장하지 못했습니다. 다시 시도해주세요."
      };
    } finally {
      pendingRef.current = null;
      if (mountedRef.current) setPendingAction(null);
    }
  }, [load]);

  const createMember = useCallback((input: MemberFormState) =>
    runMutation(
      { kind: "create", memberId: null },
      () => createMemberInRepository(input),
      (member) => setMembers((current) => [...current, member])
    ), [runMutation]);

  const updateMember = useCallback((
    id: string,
    expectedUpdatedAt: string,
    input: MemberFormState
  ) => runMutation(
    { kind: "update", memberId: id },
    () => updateMemberInRepository(id, expectedUpdatedAt, input),
    (updated) => setMembers((current) =>
      current.map((member) => member.id === updated.id ? updated : member)
    )
  ), [runMutation]);

  const hideMember = useCallback((id: string, expectedUpdatedAt: string) =>
    runMutation(
      { kind: "hide", memberId: id },
      () => hideMemberInRepository(id, expectedUpdatedAt),
      (hidden) => setMembers((current) =>
        current.map((member) => member.id === hidden.id ? hidden : member)
      )
    ), [runMutation]);

  return {
    members,
    status,
    errorMessage,
    isRefreshing,
    pendingAction,
    retry: () => load(false),
    refresh: () => load(true),
    createMember,
    updateMember,
    hideMember
  };
}
