import type {
  ChildLink,
  MemberIssue,
  MemberRecord,
  RelationIndex
} from "../types";
import {
  compareMemberNumbers,
  isValidNickname,
  normalizeSearch
} from "./formatters";

export function buildRelationIndex(members: MemberRecord[]): RelationIndex {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const lookup = new Map<string, Set<string>>();

  for (const member of members) {
    for (const value of [member.memberNumber, member.name, member.nickname]) {
      const key = normalizeSearch(value);
      if (!key) continue;
      const ids = lookup.get(key) ?? new Set<string>();
      ids.add(member.id);
      lookup.set(key, ids);
    }
  }

  const resolvedAffiliationById = new Map<string, string | null>();
  const unresolvedAffiliationIds = new Set<string>();

  for (const member of members) {
    if (member.affiliationId && memberById.has(member.affiliationId)) {
      resolvedAffiliationById.set(member.id, member.affiliationId);
      continue;
    }

    const rawKey = normalizeSearch(member.sponsorNameRaw);
    if (!rawKey) {
      resolvedAffiliationById.set(member.id, null);
      continue;
    }

    const matches = lookup.get(rawKey) ?? new Set<string>();
    const candidates = [...matches].filter((id) => id !== member.id);
    if (candidates.length === 1) {
      resolvedAffiliationById.set(member.id, candidates[0]);
    } else {
      resolvedAffiliationById.set(member.id, null);
      unresolvedAffiliationIds.add(member.id);
    }
  }

  const effectiveParentById = new Map<string, string | null>();
  for (const member of members) {
    const directParent =
      member.directParentId && memberById.has(member.directParentId)
        ? member.directParentId
        : null;
    effectiveParentById.set(
      member.id,
      directParent ?? resolvedAffiliationById.get(member.id) ?? null
    );
  }

  const childrenByParentId = new Map<string, ChildLink[]>();
  for (const member of members) {
    const directParent =
      member.directParentId && memberById.has(member.directParentId)
        ? member.directParentId
        : null;
    const affiliation = resolvedAffiliationById.get(member.id) ?? null;
    const parentId = directParent ?? affiliation;
    if (!parentId || parentId === member.id) continue;

    const relationship: ChildLink["relationship"] = directParent
      ? "direct"
      : "affiliation";
    const side = directParent
      ? member.directParentSide ??
        (affiliation === directParent ? member.side : null)
      : member.side;
    const links = childrenByParentId.get(parentId) ?? [];
    links.push({ member, side, relationship });
    childrenByParentId.set(parentId, links);
  }

  for (const links of childrenByParentId.values()) {
    links.sort((a, b) =>
      compareMemberNumbers(a.member.memberNumber, b.member.memberNumber)
    );
  }

  const cycleMemberIds = detectCycles(members, effectiveParentById);

  return {
    memberById,
    resolvedAffiliationById,
    effectiveParentById,
    childrenByParentId,
    unresolvedAffiliationIds,
    cycleMemberIds
  };
}

export function getAnchorPath(
  memberId: string,
  relations: RelationIndex
): MemberRecord[] {
  const anchors: MemberRecord[] = [];
  const seen = new Set<string>([memberId]);
  let currentId = relations.effectiveParentById.get(memberId) ?? null;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const member = relations.memberById.get(currentId);
    if (!member) break;
    if (member.isAnchorMember) anchors.push(member);
    currentId = relations.effectiveParentById.get(currentId) ?? null;
  }

  return anchors.reverse();
}

export function collectMemberIssues(
  members: MemberRecord[],
  relations: RelationIndex
): MemberIssue[] {
  const numberCounts = new Map<string, number>();
  for (const member of members) {
    if (member.isHidden || !member.memberNumber) continue;
    numberCounts.set(
      member.memberNumber,
      (numberCounts.get(member.memberNumber) ?? 0) + 1
    );
  }

  const issues: MemberIssue[] = [];
  for (const member of members) {
    if (member.isHidden) continue;
    const reasons = [...(member.importWarnings ?? [])];

    if (!member.memberNumber) reasons.push("회원번호가 없습니다.");
    if (!member.name) reasons.push("가입 이름이 없습니다.");
    if (
      member.memberNumber &&
      (numberCounts.get(member.memberNumber) ?? 0) > 1
    ) {
      reasons.push("회원번호가 중복되어 있습니다.");
    }
    if (!isValidNickname(member.nickname)) {
      reasons.push("닉네임이 한글 두 글자 이상 규칙과 맞지 않습니다.");
    }
    if (member.status === "review") {
      reasons.push("회원 상태 확인이 필요합니다.");
    }
    if (
      member.affiliationId &&
      !relations.memberById.has(member.affiliationId)
    ) {
      reasons.push("선택한 소속 회원을 찾을 수 없습니다.");
    }
    if (
      member.directParentId &&
      !relations.memberById.has(member.directParentId)
    ) {
      reasons.push("선택한 바로 위 회원을 찾을 수 없습니다.");
    }
    if (
      member.affiliationId === member.id ||
      member.directParentId === member.id
    ) {
      reasons.push("자기 자신을 상위 회원으로 선택했습니다.");
    }
    if (relations.cycleMemberIds.has(member.id)) {
      reasons.push("상위 회원 연결이 순환하고 있습니다.");
    }

    if (reasons.length > 0) {
      issues.push({ memberId: member.id, reasons: [...new Set(reasons)] });
    }
  }

  return issues;
}

export function wouldCreateCycle(
  memberId: string,
  parentId: string | null,
  relations: RelationIndex
): boolean {
  if (!parentId) return false;
  if (memberId === parentId) return true;

  const seen = new Set<string>();
  let currentId: string | null = parentId;
  while (currentId && !seen.has(currentId)) {
    if (currentId === memberId) return true;
    seen.add(currentId);
    currentId = relations.effectiveParentById.get(currentId) ?? null;
  }
  return false;
}

function detectCycles(
  members: MemberRecord[],
  effectiveParentById: Map<string, string | null>
): Set<string> {
  const cycleIds = new Set<string>();

  for (const member of members) {
    const order: string[] = [];
    const position = new Map<string, number>();
    let currentId: string | null = member.id;

    while (currentId) {
      if (position.has(currentId)) {
        const start = position.get(currentId) ?? 0;
        order.slice(start).forEach((id) => cycleIds.add(id));
        break;
      }
      position.set(currentId, order.length);
      order.push(currentId);
      currentId = effectiveParentById.get(currentId) ?? null;
    }
  }

  return cycleIds;
}
