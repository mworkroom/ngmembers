import { useEffect, useMemo, useState } from "react";
import type {
  MemberIssue,
  MemberRecord,
  RelationIndex
} from "../types";
import {
  compareMemberNumbers,
  displayName
} from "../utils/formatters";
import { BackIcon, CloseIcon } from "./Icons";

type ManagementView = "home" | "issues" | "withdrawn" | "hidden" | "unresolved";

interface ManagementPanelProps {
  open: boolean;
  members: MemberRecord[];
  relations: RelationIndex;
  issues: MemberIssue[];
  onClose: () => void;
  onNavigate: (memberId: string) => void;
}

export function ManagementPanel({
  open,
  members,
  relations,
  issues,
  onClose,
  onNavigate
}: ManagementPanelProps) {
  const [view, setView] = useState<ManagementView>("home");

  useEffect(() => {
    if (open) setView("home");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const issueMap = useMemo(
    () => new Map(issues.map((issue) => [issue.memberId, issue.reasons])),
    [issues]
  );
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        compareMemberNumbers(a.memberNumber, b.memberNumber)
      ),
    [members]
  );
  const issueMembers = sortedMembers.filter((member) => issueMap.has(member.id));
  const withdrawnMembers = sortedMembers.filter(
    (member) => member.status === "withdrawn" && !member.isHidden
  );
  const hiddenMembers = sortedMembers.filter((member) => member.isHidden);
  const unresolvedMembers = sortedMembers.filter(
    (member) =>
      !member.isHidden && relations.unresolvedAffiliationIds.has(member.id)
  );

  if (!open) return null;

  const viewConfig = {
    issues: { title: "데이터 확인", members: issueMembers },
    withdrawn: { title: "탈퇴 회원", members: withdrawnMembers },
    hidden: { title: "숨긴 회원", members: hiddenMembers },
    unresolved: { title: "스폰서 정리 미완료", members: unresolvedMembers }
  } as const;

  return (
    <div
      className="management-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="management-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="management-heading">
          {view !== "home" ? (
            <button
              type="button"
              className="icon-button"
              aria-label="관리 첫 화면으로"
              onClick={() => setView("home")}
            >
              <BackIcon />
            </button>
          ) : null}
          <div>
            <h2 id="management-title">
              {view === "home" ? "회원 관리" : viewConfig[view].title}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button management-close"
            aria-label="닫기"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        {view === "home" ? (
          <>
            <div className="management-menu">
              <ManagementMenuButton
                label="데이터 확인"
                description="중복 회원번호·이름 누락·상태 확인"
                count={issueMembers.length}
                tone="review"
                onClick={() => setView("issues")}
              />
              <ManagementMenuButton
                label="탈퇴 회원"
                description="탈퇴 상태로 표시된 회원"
                count={withdrawnMembers.length}
                tone="withdrawn"
                onClick={() => setView("withdrawn")}
              />
              <ManagementMenuButton
                label="숨긴 회원"
                description="앱 목록에서 숨김 처리된 회원"
                count={hiddenMembers.length}
                tone="hidden"
                onClick={() => setView("hidden")}
              />
              <ManagementMenuButton
                label="스폰서 연결 미완료"
                description="스폰서 정보가 없는 회원"
                count={unresolvedMembers.length}
                tone="muted"
                onClick={() => setView("unresolved")}
              />
            </div>
          </>
        ) : (
          <ManagementMemberList
            view={view}
            members={viewConfig[view].members}
            issueMap={issueMap}
            onNavigate={(memberId) => {
              onNavigate(memberId);
              onClose();
            }}
          />
        )}
      </section>
    </div>
  );
}

function ManagementMenuButton({
  label,
  description,
  count,
  tone,
  onClick
}: {
  label: string;
  description?: string;
  count: number;
  tone: "review" | "withdrawn" | "hidden" | "muted";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`management-menu-button tone-${tone}`}
      onClick={onClick}
    >
      <span>
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <b>{count}</b>
    </button>
  );
}

function ManagementMemberList({
  view,
  members,
  issueMap,
  onNavigate
}: {
  view: Exclude<ManagementView, "home">;
  members: MemberRecord[];
  issueMap: Map<string, string[]>;
  onNavigate: (memberId: string) => void;
}) {
  if (members.length === 0) {
    return <p className="management-empty">해당 회원이 없습니다.</p>;
  }

  return (
    <div className="management-member-list">
      {members.map((member) => (
        <article key={member.id} className="management-member-row">
          <button
            type="button"
            className="management-member-main"
            disabled={view === "hidden"}
            onClick={() => onNavigate(member.id)}
          >
            <strong>{displayName(member)}</strong>
            <span>
              {member.nickname ? `${member.nickname} · ` : ""}
              {member.memberNumber}
            </span>
            {view === "issues" ? (
              <small>{(issueMap.get(member.id) ?? []).join(" · ")}</small>
            ) : null}
            {view === "unresolved" ? (
              <small>기존 메모: {member.sponsorNameRaw}</small>
            ) : null}
          </button>
        </article>
      ))}
    </div>
  );
}
