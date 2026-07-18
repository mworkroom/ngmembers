import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { FilterTabs } from "./components/FilterTabs";
import { Header } from "./components/Header";
import { ManagementPanel } from "./components/ManagementPanel";
import { MemberCard } from "./components/MemberCard";
import { MemberEditor } from "./components/MemberEditor";
import { SearchBar } from "./components/SearchBar";
import { Toast } from "./components/Toast";
import { clearStoredMembers, getSeedMembers, loadMembers, saveMembers } from "./lib/storage";
import type {
  MainFilter,
  MemberFormState,
  MemberRecord
} from "./types";
import { exportMembersToCsv, importMembersFromCsv } from "./utils/csv";
import {
  compareMemberNumbers,
  displayName,
  normalizeLooseText,
  normalizeSearch
} from "./utils/formatters";
import {
  buildRelationIndex,
  collectMemberIssues,
  wouldCreateCycle
} from "./utils/relations";

type EditorMode = "new" | string | null;

interface AppProps {
  role: "admin";
  onSignOut: () => Promise<void>;
}

type ConfirmState =
  | { kind: "hide"; memberId: string }
  | { kind: "reset" }
  | { kind: "import"; members: MemberRecord[]; warnings: string[] }
  | null;

export default function App({ role, onSignOut }: AppProps) {
  const [members, setMembers] = useState<MemberRecord[]>(loadMembers);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MainFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [managementOpen, setManagementOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [toast, setToast] = useState("");

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

  useEffect(() => {
    document.documentElement.lang = "ko";
    document.title = "회원 계보 찾기";
  }, []);

  useEffect(() => {
    saveMembers(members);
  }, [members]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const normalized = normalizeSearch(query);
    if (normalized) {
      const exact = filteredMembers.filter((member) =>
        [member.memberNumber, member.name, member.nickname, member.phone]
          .map(normalizeSearch)
          .includes(normalized)
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
        role={role}
      />

      <SearchBar value={query} onChange={setQuery} />
      <FilterTabs value={filter} counts={filterCounts} onChange={setFilter} />

      <div className="list-meta" aria-live="polite">
        <span>{query ? `검색 결과 ${filteredMembers.length}명` : `${filteredMembers.length}명`}</span>
        {query ? (
          <button type="button" onClick={() => setQuery("")}>
            검색 해제
          </button>
        ) : null}
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
              onToggle={(memberId) =>
                setExpandedId((current) => (current === memberId ? null : memberId))
              }
              onNavigate={navigateToMember}
              onEdit={(memberId) => setEditorMode(memberId)}
              onHide={(memberId) => setConfirmState({ kind: "hide", memberId })}
            />
          ))
        ) : (
          <div className="empty-state">
            <strong>검색 결과가 없습니다.</strong>
            <span>회원번호나 닉네임을 다시 확인해주세요.</span>
          </div>
        )}
      </section>

      {editorMode ? (
        <MemberEditor
          member={editingMember}
          members={pickerMembers}
          relations={relations}
          onClose={() => setEditorMode(null)}
          onSave={saveMember}
        />
      ) : null}

      <ManagementPanel
        open={managementOpen}
        members={members}
        relations={relations}
        issues={issues}
        onClose={() => setManagementOpen(false)}
        onNavigate={navigateToMember}
        onRestore={restoreMember}
        onImportCsv={importCsvFile}
        onExportCsv={exportCsvFile}
        onReset={() => setConfirmState({ kind: "reset" })}
      />

      <ConfirmDialog
        open={confirmState?.kind === "hide"}
        title="이 회원을 숨길까요?"
        message="회원은 삭제되지 않고 관리 화면의 숨긴 회원에 보관됩니다."
        confirmLabel="숨기기"
        danger
        onConfirm={confirmHide}
        onCancel={() => setConfirmState(null)}
      />

      <ConfirmDialog
        open={confirmState?.kind === "reset"}
        title="처음 샘플로 되돌릴까요?"
        message="브라우저에서 수정한 내용이 모두 사라지고 첨부 CSV의 초기 상태로 돌아갑니다."
        confirmLabel="초기화"
        danger
        onConfirm={confirmReset}
        onCancel={() => setConfirmState(null)}
      />

      <ConfirmDialog
        open={confirmState?.kind === "import"}
        title="새 CSV로 교체할까요?"
        message={
          confirmState?.kind === "import"
            ? `${confirmState.members.length}명의 데이터로 현재 브라우저 데이터를 교체합니다.`
            : ""
        }
        confirmLabel="CSV 교체"
        onConfirm={confirmImport}
        onCancel={() => setConfirmState(null)}
      />

      <Toast message={toast} />
    </main>
  );

  function navigateToMember(memberId: string) {
    const member = relations.memberById.get(memberId);
    if (!member) return;
    if (member.isHidden) {
      setToast("숨긴 회원입니다. 관리 화면에서 먼저 복원해주세요.");
      return;
    }

    setFilter("all");
    setQuery(member.memberNumber || member.name || member.nickname);
    setExpandedId(member.id);
    setManagementOpen(false);

    window.setTimeout(() => {
      document
        .getElementById(`member-${member.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function saveMember(state: MemberFormState) {
    if (editingMember) {
      if (
        wouldCreateCycle(editingMember.id, state.affiliationId, relations) ||
        wouldCreateCycle(editingMember.id, state.directParentId, relations)
      ) {
        setToast("이 연결은 계보가 서로 순환하게 되어 저장할 수 없습니다.");
        return;
      }

      const affiliation = state.affiliationId
        ? relations.memberById.get(state.affiliationId)
        : null;
      setMembers((current) =>
        current.map((member) =>
          member.id === editingMember.id
            ? {
                ...member,
                ...state,
                name: state.name.trim(),
                nickname: state.nickname.trim(),
                countryCode: state.countryCode.trim().toUpperCase(),
                sponsorNameRaw: affiliation
                  ? affiliation.nickname || affiliation.name || affiliation.memberNumber
                  : state.sponsorNameRaw,
                importWarnings: []
              }
            : member
        )
      );
      setEditorMode(null);
      setToast("회원 정보를 수정했습니다.");
      window.setTimeout(() => navigateToMember(editingMember.id), 20);
      return;
    }

    const id = `local-${crypto.randomUUID()}`;
    const affiliation = state.affiliationId
      ? relations.memberById.get(state.affiliationId)
      : null;
    const newMember: MemberRecord = {
      id,
      ...state,
      name: state.name.trim(),
      nickname: state.nickname.trim(),
      countryCode: state.countryCode.trim().toUpperCase(),
      sponsorNameRaw: affiliation
        ? affiliation.nickname || affiliation.name || affiliation.memberNumber
        : "",
      isHidden: false,
      importWarnings: []
    };
    setMembers((current) => [...current, newMember]);
    setEditorMode(null);
    setToast("새 회원을 추가했습니다.");
    window.setTimeout(() => {
      setFilter("all");
      setQuery(newMember.memberNumber);
      setExpandedId(id);
    }, 20);
  }

  function confirmHide() {
    if (confirmState?.kind !== "hide") return;
    const memberId = confirmState.memberId;
    setMembers((current) =>
      current.map((member) =>
        member.id === memberId ? { ...member, isHidden: true } : member
      )
    );
    setExpandedId(null);
    setConfirmState(null);
    setToast("회원이 숨김 처리되었습니다.");
  }

  function restoreMember(memberId: string) {
    setMembers((current) =>
      current.map((member) =>
        member.id === memberId ? { ...member, isHidden: false } : member
      )
    );
    setToast("숨긴 회원을 복원했습니다.");
  }

  async function importCsvFile(file: File) {
    try {
      const text = await file.text();
      const result = importMembersFromCsv(text);
      setConfirmState({
        kind: "import",
        members: result.members,
        warnings: result.warnings
      });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "CSV를 읽지 못했습니다.");
    }
  }

  function confirmImport() {
    if (confirmState?.kind !== "import") return;
    const { members: imported, warnings } = confirmState;
    setMembers(imported);
    setQuery("");
    setFilter("all");
    setExpandedId(null);
    setConfirmState(null);
    setManagementOpen(false);
    setToast(
      warnings.length > 0
        ? `${imported.length}명 불러옴 · ${warnings.join(" ")}`
        : `${imported.length}명을 불러왔습니다.`
    );
  }

  function exportCsvFile() {
    const csv = exportMembersToCsv(members);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast("현재 데이터를 CSV로 저장했습니다.");
  }

  function confirmReset() {
    clearStoredMembers();
    setMembers(getSeedMembers());
    setQuery("");
    setFilter("all");
    setExpandedId(null);
    setConfirmState(null);
    setManagementOpen(false);
    setToast("처음 샘플 데이터로 초기화했습니다.");
  }
}

function getSearchRank(
  member: MemberRecord,
  rawQuery: string,
  normalizedQuery: string
): number {
  const number = normalizeSearch(member.memberNumber);
  const nickname = normalizeSearch(member.nickname);
  const name = normalizeSearch(member.name);
  const phone = normalizeSearch(member.phone);

  if (number === normalizedQuery) return 0;
  if (nickname === normalizedQuery) return 1;
  if (name === normalizedQuery) return 2;
  if (phone === normalizedQuery) return 3;
  if (number.startsWith(normalizedQuery)) return 4;
  if (nickname.startsWith(normalizedQuery)) return 5;
  if (name.startsWith(normalizedQuery)) return 6;
  if (phone.includes(normalizedQuery)) return 7;

  const tokens = normalizeLooseText(rawQuery)
    .split(/\s+/)
    .map(normalizeSearch)
    .filter(Boolean);
  const haystack = normalizeSearch(
    `${member.memberNumber} ${member.name} ${member.nickname} ${member.phone}`
  );
  if (tokens.length > 0 && tokens.every((token) => haystack.includes(token))) return 8;
  if (nickname.includes(normalizedQuery)) return 9;
  if (name.includes(normalizedQuery)) return 10;
  if (number.includes(normalizedQuery)) return 11;
  return 99;
}
