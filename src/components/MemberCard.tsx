import { useMemo, useState } from "react";
import type {
  ChildLink,
  MemberRecord,
  MemberSide,
  RelationIndex
} from "../types";
import {
  countryLabel,
  displayName,
  formatBirthDate,
  formatCpf,
  formatMemberSubline,
  formatPhone,
  sideLabel
} from "../utils/formatters";
import { getAnchorPath } from "../utils/relations";
import { ChevronIcon } from "./Icons";

interface MemberCardProps {
  member: MemberRecord;
  expanded: boolean;
  relations: RelationIndex;
  issueReasons: string[];
  onToggle: (memberId: string) => void;
  onNavigate: (memberId: string) => void;
  onEdit: (memberId: string) => void;
  onHide: (memberId: string) => void;
}

export function MemberCard({
  member,
  expanded,
  relations,
  issueReasons,
  onToggle,
  onNavigate,
  onEdit,
  onHide
}: MemberCardProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );
  const affiliationId = relations.resolvedAffiliationById.get(member.id) ?? null;
  const affiliation = affiliationId
    ? relations.memberById.get(affiliationId) ?? null
    : null;
  const directParent = member.directParentId
    ? relations.memberById.get(member.directParentId) ?? null
    : null;
  const anchorPath = useMemo(
    () => getAnchorPath(member.id, relations),
    [member.id, relations]
  );
  const childLinks = (relations.childrenByParentId.get(member.id) ?? []).filter(
    (link) => !link.member.isHidden
  );
  const groups = groupChildren(childLinks);
  const showAnchorPath =
    anchorPath.length > 1 ||
    (anchorPath.length === 1 && anchorPath[0].id !== affiliation?.id);
  const hasReview = member.status === "review" || issueReasons.length > 0;
  const infoRows = buildInfoRows(member);

  return (
    <article
      id={`member-${member.id}`}
      className={`member-card ${expanded ? "expanded" : ""}`}
    >
      <button
        type="button"
        className="member-summary"
        aria-expanded={expanded}
        onClick={() => onToggle(member.id)}
      >
        <span className="member-summary-copy">
          <strong className="member-summary-name" title={displayName(member)}>
            {displayName(member)}
          </strong>
          <span className="member-summary-meta">
            {formatMemberSubline(member).map((part, index) => (
              <span key={`${part}-${index}`}>{part}</span>
            ))}
          </span>
        </span>
        <ChevronIcon className="member-chevron" />
      </button>

      {expanded ? (
        <div className="member-details">
          <div className="member-badges" aria-label="회원 표시">
            {member.isAnchorMember ? (
              <span className="badge badge-anchor">주요 사업자</span>
            ) : null}
            {member.isFavorite ? (
              <span className="badge badge-favorite">관심 회원</span>
            ) : null}
            {member.status === "withdrawn" ? (
              <span className="badge badge-withdrawn">탈퇴</span>
            ) : null}
            {hasReview ? (
              <span className="badge badge-review">확인 필요</span>
            ) : null}
          </div>

          {(affiliation || member.sponsorNameRaw) && (
            <section className="relationship-block">
              <span className="relationship-label">스폰서</span>
              <div className="relationship-value">
                {affiliation ? (
                  <MemberTextButton
                    member={affiliation}
                    onClick={() => onNavigate(affiliation.id)}
                  />
                ) : (
                  <strong>{member.sponsorNameRaw}</strong>
                )}
                {member.side ? (
                  <span className="relationship-side">· {sideLabel(member.side)}</span>
                ) : null}
              </div>
            </section>
          )}

          {showAnchorPath ? (
            <section className="relationship-block relationship-path-block">
              <span className="relationship-label">라인</span>
              <div className="anchor-path">
                {anchorPath.map((anchor, index) => (
                  <span key={anchor.id} className="anchor-path-item">
                    {index > 0 ? <span className="path-separator">›</span> : null}
                    <button type="button" onClick={() => onNavigate(anchor.id)}>
                      {anchor.nickname || displayName(anchor)}
                    </button>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {directParent ? (
            <section className="relationship-block">
              <span className="relationship-label">바로 위 회원</span>
              <div className="relationship-value">
                <MemberTextButton
                  member={directParent}
                  onClick={() => onNavigate(directParent.id)}
                />
                {member.directParentSide ? (
                  <span className="relationship-side">
                    · {sideLabel(member.directParentSide)}
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}

          {infoRows.length > 0 ? (
            <dl className="member-info">
              {infoRows.map((row) => (
                <div key={row.label} className="info-row">
                  <dt>{row.label}</dt>
                  <dd>
                    {row.href ? <a href={row.href}>{row.value}</a> : row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {issueReasons.length > 0 ? (
            <details className="issue-details">
              <summary>확인할 내용 {issueReasons.length}개</summary>
              <ul>
                {issueReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {childLinks.length > 0 ? (
            <section className="connections-section">
              <h3>연결된 회원</h3>
              <ConnectionGroup
                label="좌"
                groupKey="left"
                links={groups.left}
                expanded={expandedGroups.has("left")}
                onToggle={() => toggleGroup("left")}
                onNavigate={onNavigate}
              />
              <ConnectionGroup
                label="우"
                groupKey="right"
                links={groups.right}
                expanded={expandedGroups.has("right")}
                onToggle={() => toggleGroup("right")}
                onNavigate={onNavigate}
              />
              <ConnectionGroup
                label="위치 미확인"
                groupKey="unknown"
                links={groups.unknown}
                expanded={expandedGroups.has("unknown")}
                onToggle={() => toggleGroup("unknown")}
                onNavigate={onNavigate}
              />
            </section>
          ) : null}

          <div className="member-card-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => onEdit(member.id)}
            >
              수정
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => onHide(member.id)}
            >
              숨기기
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );

  function toggleGroup(key: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
}

function MemberTextButton({
  member,
  onClick
}: {
  member: MemberRecord;
  onClick: () => void;
}) {
  return (
    <button type="button" className="member-link-button" onClick={onClick}>
      {member.nickname || displayName(member)}
    </button>
  );
}

function ConnectionGroup({
  label,
  groupKey,
  links,
  expanded,
  onToggle,
  onNavigate
}: {
  label: string;
  groupKey: string;
  links: ChildLink[];
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (memberId: string) => void;
}) {
  if (links.length === 0) return null;
  const visible = expanded ? links : links.slice(0, 8);
  const remaining = links.length - visible.length;

  return (
    <div className={`connection-group connection-${groupKey}`}>
      <div className="connection-heading">
        <strong>{label}</strong>
        <span>{links.length}명</span>
      </div>
      <ul className="connection-list">
        {visible.map(({ member }) => (
          <li key={member.id}>
            <button type="button" onClick={() => onNavigate(member.id)}>
              <strong title={displayName(member)}>{displayName(member)}</strong>
              <span>
                {member.nickname ? `${member.nickname} · ` : ""}
                {member.memberNumber}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {links.length > 8 ? (
        <button type="button" className="connection-more" onClick={onToggle}>
          {expanded ? "접기" : `${remaining}명 더 보기`}
        </button>
      ) : null}
    </div>
  );
}

function groupChildren(links: ChildLink[]): Record<"left" | "right" | "unknown", ChildLink[]> {
  return links.reduce(
    (groups, link) => {
      if (link.side === "left") groups.left.push(link);
      else if (link.side === "right") groups.right.push(link);
      else groups.unknown.push(link);
      return groups;
    },
    { left: [], right: [], unknown: [] } as Record<
      "left" | "right" | "unknown",
      ChildLink[]
    >
  );
}

function buildInfoRows(member: MemberRecord): Array<{
  label: string;
  value: string;
  href?: string;
}> {
  const rows: Array<{ label: string; value: string; href?: string }> = [];
  const birthDate = formatBirthDate(member.birthDate);
  const phone = formatPhone(member.phone, member.countryCode);
  const cpf = formatCpf(member.cpf);

  if (birthDate) rows.push({ label: "생년월일", value: birthDate });
  if (phone) rows.push({ label: "전화번호", value: phone, href: `tel:${member.phone}` });
  if (cpf) rows.push({ label: "CPF", value: cpf });
  if (member.notes) rows.push({ label: "메모", value: member.notes });
  if (!member.countryCode) {
    rows.push({ label: "국가", value: countryLabel(member.countryCode) });
  }

  return rows;
}
