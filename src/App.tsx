import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { FilterTabs } from "./components/FilterTabs";
import { Header } from "./components/Header";
import { ManagementPanel } from "./components/ManagementPanel";
import { MemberCard } from "./components/MemberCard";
import { MemberEditor } from "./components/MemberEditor";
import { SearchBar } from "./components/SearchBar";
import { Toast } from "./components/Toast";
import { labels } from "./content/labels";
import { useMembers } from "./hooks/useMembers";
import { clearLegacyMemberStorage } from "./lib/legacyStorageCleanup";
import type { MainFilter, MemberFormState, MemberRecord } from "./types";
import {
  compareMemberNumbers,
  displayName,
  normalizeSearch
} from "./utils/formatters";
import { getSearchRank, isExactMemberNumberMatch } from "./utils/memberSearch";
import {
  buildRelationIndex,
  collectMemberIssues,
  wouldCreateCycle
} from "./utils/relations";

type EditorMode = "new" | string | null;

interface AppProps {
  email: string | null;
  onSignOut: () => Promise<void>;
}

type ConfirmState = { kind: "hide"; memberId: string } | null;

export default function App({ email, onSignOut }: AppProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MainFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [managementOpen, setManagementOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [toast, setToast] = useState("");
  const memberState = useMembers({
    autoRefreshEnabled: editorMode === null && confirmState === null
  });
  const members = memberState.members;

  const relations = useMemo(() => buildRelationIndex(members), [members]);
  const issues = useMemo(
    () => collectMemberIssues(members, relations),
    [members, relations]
  );
  const issueMap = useMemo(
    () => new Map(issues.map((issue) => [issue.memberId, issue.reasons])),
    [issues]
  );
  const visibleMembers = useMemo(
    () => members.filter((member) => !member.isHidden),
    [members]
  );
  const pickerMembers = visibleMembers;

  const filterCounts = useMemo(
    () => ({
      all: visibleMembers.length,
      anchor: visibleMembers.filter((member) => member.isAnchorMember).length,
      favorite: visibleMembers.filter((member) => member.isFavorite).length
    }),
    [visibleMembers]
  );

  const filteredMembers = useMemo(() => {
    const byFilter = visibleMembers.filter((member) => {
      if (filter === "anchor") return member.isAnchorMember;
      if (filter === "favorite") return member.isFavorite;
      return true;
    });

    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) {
      return [...byFilter].sort((a, b) =>
        compareMemberNumbers(a.memberNumber, b.memberNumber)
      );
    }

    return byFilter
      .map((member) => ({
        member,
        rank: getSearchRank(member, query, normalizedQuery)
      }))
      .filter((item) => item.rank < 99)
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          compareMemberNumbers(a.member.memberNumber, b.member.memberNumber)
      )
      .map((item) => item.member);
  }, [filter, query, visibleMembers]);

  const editingMember =
    editorMode && editorMode !== "new"
      ? relations.memberById.get(editorMode) ?? null
      : null;
  const writePending = memberState.pendingAction !== null;

  useEffect(() => {
    document.documentElement.lang = "ko";
    document.title = labels.app.title;
    clearLegacyMemberStorage();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const normalized = normalizeSearch(query);
    if (normalized) {
      const exact = filteredMembers.filter((member) =>
        isExactMemberNumberMatch(member, normalized)
      );
      if (exact.length === 1) {
        setExpandedId(exact[0].id);
        return;
      }
    }

    setExpandedId((current) =>
      current && filteredMembers.some((member) => member.id === current)
        ? current
        : null
    );
  }, [filteredMembers, query]);

  return (
    <main className="app-shell">
      <Header
        onAdd={() => setEditorMode("new")}
        onManage={() => setManagementOpen(true)}
        onSignOut={onSignOut}
        email={email}
        dataActionsDisabled={memberState.status !== "ready" || writePending}
      />

      {memberState.status === "loading" ? (
        <MemberDataState
          title="회원 데이터를 불러오는 중입니다."
          description="전체 회원과 관계를 확인한 뒤 목록을 표시합니다."
        />
      ) : memberState.status === "error" ? (
        <MemberDataState
          title="회원 데이터를 불러오지 못했습니다."
          description={memberState.errorMessage ?? "잠시 후 다시 시도해주세요."}
          onRetry={() => void memberState.retry()}
        />
      ) : (
        <>
          <SearchBar value={query} onChange={setQuery} />
          <FilterTabs value={filter} counts={filterCounts} onChange={setFilter} />

          {memberState.errorMessage ? (
            <div className="data-error-banner" role="alert">
              <span>{memberState.errorMessage}</span>
              <button type="button" onClick={() => void memberState.refresh()}>
                다시 확인
              </button>
            </div>
          ) : null}

          <div className="list-meta" aria-live="polite">
            <span>
              {query
                ? "검색 결과 " + filteredMembers.length + "명"
                : filteredMembers.length + "명"}
            </span>
            <div className="list-meta-actions">
              {query ? (
                <button type="button" onClick={() => setQuery("")}>
                  검색 해제
                </button>
              ) : null}
              <button
                type="button"
                disabled={memberState.isRefreshing || writePending}
                onClick={() => void memberState.refresh()}
              >
                {memberState.isRefreshing ? "새로고침 중" : "새로고침"}
              </button>
            </div>
          </div>

          <section className="member-list" aria-label="회원 목록">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  expanded={expandedId === member.id}
                  relations={relations}
                  issueReasons={issueMap.get(member.id) ?? []}
                  actionsDisabled={writePending}
                  onToggle={(memberId) =>
                    setExpandedId((current) =>
                      current === memberId ? null : memberId
                    )
                  }
                  onNavigate={navigateToMember}
                  onEdit={(memberId) => setEditorMode(memberId)}
                  onHide={(memberId) =>
                    setConfirmState({ kind: "hide", memberId })
                  }
                />
              ))
            ) : (
              <div className="empty-state">
                <strong>{labels.search.emptyTitle}</strong>
                <span>{labels.search.emptyDescription}</span>
              </div>
            )}
          </section>
        </>
      )}

      {memberState.status === "ready" && editorMode ? (
        <MemberEditor
          member={editingMember}
          members={pickerMembers}
          relations={relations}
          pending={
            memberState.pendingAction?.kind === "create" ||
            (memberState.pendingAction?.kind === "update" &&
              memberState.pendingAction.memberId === editingMember?.id)
          }
          onClose={() => setEditorMode(null)}
          onSave={saveMember}
        />
      ) : null}

      <ManagementPanel
        open={memberState.status === "ready" && managementOpen}
        members={members}
        relations={relations}
        issues={issues}
        onClose={() => setManagementOpen(false)}
        onNavigate={navigateToMember}
      />

      <ConfirmDialog
        open={confirmState?.kind === "hide"}
        title="이 회원을 숨길까요?"
        message="회원은 삭제되지 않고 관리 화면의 숨긴 회원에 보관됩니다."
        confirmLabel="숨기기"
        danger
        pending={memberState.pendingAction?.kind === "hide"}
        onConfirm={() => void confirmHide()}
        onCancel={() => setConfirmState(null)}
      />

      <Toast message={toast} />
    </main>
  );

  function navigateToMember(memberId: string) {
    const member = relations.memberById.get(memberId);
    if (!member) return;
    if (member.isHidden) {
      setToast("숨김 처리된 회원입니다.");
      return;
    }

    focusMember(member);
    setManagementOpen(false);
  }

  function focusMember(member: MemberRecord) {
    setFilter("all");
    setQuery(member.memberNumber || member.name || member.nickname);
    setExpandedId(member.id);

    window.setTimeout(() => {
      document
        .getElementById("member-" + member.id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function saveMember(state: MemberFormState) {
    if (editingMember) {
      if (
        wouldCreateCycle(editingMember.id, state.affiliationId, relations) ||
        wouldCreateCycle(editingMember.id, state.directParentId, relations)
      ) {
        setToast("이 연결은 계보가 서로 순환하게 되어 저장할 수 없습니다.");
        return;
      }

      const result = await memberState.updateMember(
        editingMember.id,
        editingMember.updatedAt,
        withSponsorName(state)
      );
      if (!result.ok) {
        setToast(result.message);
        return;
      }

      setEditorMode(null);
      setToast("회원 정보를 수정했습니다.");
      window.setTimeout(() => focusMember(result.member), 20);
      return;
    }

    const result = await memberState.createMember(withSponsorName(state));
    if (!result.ok) {
      setToast(result.message);
      return;
    }

    setEditorMode(null);
    setToast("새 회원을 추가했습니다.");
    window.setTimeout(() => focusMember(result.member), 20);
  }

  function withSponsorName(state: MemberFormState): MemberFormState {
    const affiliation = state.affiliationId
      ? relations.memberById.get(state.affiliationId)
      : null;
    return {
      ...state,
      sponsorNameRaw: affiliation
        ? affiliation.nickname || affiliation.name || affiliation.memberNumber
        : state.sponsorNameRaw
    };
  }

  async function confirmHide() {
    if (confirmState?.kind !== "hide") return;
    const member = relations.memberById.get(confirmState.memberId);
    if (!member) {
      setConfirmState(null);
      return;
    }

    const result = await memberState.hideMember(member.id, member.updatedAt);
    if (!result.ok) {
      setToast(result.message);
      return;
    }

    setExpandedId(null);
    setConfirmState(null);
    setToast("회원이 숨김 처리되었습니다.");
  }
}

function MemberDataState({
  title,
  description,
  onRetry
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <section className="member-data-state" aria-live="polite">
      <strong>{title}</strong>
      <span>{description}</span>
      {onRetry ? (
        <button type="button" className="primary-button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </section>
  );
}
