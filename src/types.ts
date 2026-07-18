export type MemberStatus = "active" | "withdrawn" | "review";
export type MemberSide = "left" | "right" | null;
export type MainFilter = "all" | "anchor" | "favorite";

export interface MemberRecord {
  id: string;
  memberNumber: string;
  name: string;
  nickname: string;
  isAnchorMember: boolean;
  isFavorite: boolean;
  sponsorNameRaw: string;
  affiliationId: string | null;
  side: MemberSide;
  directParentId: string | null;
  directParentSide: MemberSide;
  birthDate: string;
  phone: string;
  countryCode: string;
  cpf: string;
  notes: string;
  status: MemberStatus;
  isHidden: boolean;
  importWarnings?: string[];
}

export interface MemberFormState {
  memberNumber: string;
  name: string;
  nickname: string;
  isAnchorMember: boolean;
  isFavorite: boolean;
  affiliationId: string | null;
  sponsorNameRaw: string;
  side: MemberSide;
  directParentId: string | null;
  directParentSide: MemberSide;
  birthDate: string;
  phone: string;
  countryCode: string;
  cpf: string;
  notes: string;
  status: MemberStatus;
}

export interface RelationIndex {
  memberById: Map<string, MemberRecord>;
  resolvedAffiliationById: Map<string, string | null>;
  effectiveParentById: Map<string, string | null>;
  childrenByParentId: Map<string, ChildLink[]>;
  unresolvedAffiliationIds: Set<string>;
  cycleMemberIds: Set<string>;
}

export interface ChildLink {
  member: MemberRecord;
  side: MemberSide;
  relationship: "direct" | "affiliation";
}

export interface MemberIssue {
  memberId: string;
  reasons: string[];
}
