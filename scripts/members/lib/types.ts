export const MEMBER_HEADERS = [
  "member_number",
  "name",
  "nickname",
  "is_anchor_member",
  "sponsor_name_raw",
  "side",
  "birth_date",
  "phone",
  "country_code",
  "cpf",
  "notes",
  "member_status",
  "is_favorite",
  "is_hidden"
] as const;

export type MemberField = (typeof MEMBER_HEADERS)[number];
export type IssueSeverity = "error" | "warning" | "info";

export interface CsvRecord {
  line: number;
  values: string[];
}

export interface SourceMemberRow {
  sourceRow: number;
  values: Record<MemberField, string>;
}

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  row: number | null;
  field: MemberField | null;
}

export interface NormalizedMember {
  memberNumber: string | null;
  name: string | null;
  nickname: string | null;
  isAnchorMember: boolean;
  isFavorite: boolean;
  sponsorNameRaw: string | null;
  side: "left" | "right" | null;
  birthDate: string | null;
  phone: string | null;
  countryCode: string | null;
  cpf: string | null;
  notes: string | null;
  memberStatus: "active" | "withdrawn" | "review";
  isHidden: boolean;
}

export interface ValidatedMemberRow {
  source: SourceMemberRow;
  normalized: NormalizedMember;
  affiliationSourceRow: number | null;
  affiliationCandidateRows: number[];
}

export interface CorrectionEntry {
  row: number;
  field: MemberField;
  value: string | null;
  reason: string;
}

export interface WarningApproval {
  decision: "accept";
  reason: string;
}

export interface CorrectionsManifest {
  version: 1;
  sourceSha256: string;
  approvedBy: string;
  approvedAt: string | null;
  corrections: CorrectionEntry[];
  warningApprovals: Record<string, WarningApproval>;
}

export interface ValidationRun {
  sourceName: string;
  sourceSha256: string;
  sourceByteLength: number;
  hasUtf8Bom: boolean;
  header: string[];
  rows: ValidatedMemberRow[];
  issues: ValidationIssue[];
  appliedCorrectionCount: number;
  correctionsManifest: CorrectionsManifest | null;
  distributions: ValidationDistributions;
  relationCounts: RelationCounts;
  nullCounts: Record<string, number>;
}

export interface ValidationDistributions {
  memberStatus: Record<string, number>;
  countryCode: Record<string, number>;
  side: Record<string, number>;
  isAnchorMember: Record<string, number>;
  isFavorite: Record<string, number>;
  isHidden: Record<string, number>;
}

export interface RelationCounts {
  linked: number;
  unresolved: number;
  ambiguous: number;
  self: number;
  missing: number;
}

export interface PreparedMember {
  id: string;
  member_number: string | null;
  name: string | null;
  nickname: string | null;
  is_anchor_member: boolean;
  is_favorite: boolean;
  sponsor_name_raw: string | null;
  affiliation_id: string | null;
  side: "left" | "right" | null;
  direct_parent_id: null;
  direct_parent_side: null;
  birth_date: string | null;
  phone: string | null;
  country_code: string | null;
  cpf: string | null;
  notes: string | null;
  member_status: "active" | "withdrawn" | "review";
  is_hidden: boolean;
}

export interface PreparedSummary {
  rowCount: number;
  relationCount: number;
  nullCounts: Record<string, number>;
  distributions: ValidationDistributions;
  relationCounts: RelationCounts;
}

export interface PreparedPayloadBase {
  version: 1;
  sourceSha256: string;
  rowCount: number;
  summary: PreparedSummary;
  members: PreparedMember[];
}

export interface PreparedPayload extends PreparedPayloadBase {
  preparedSha256: string;
}

export interface PreparationResult {
  validation: ValidationRun;
  payload: PreparedPayload;
  outputPath: string;
  rollbackPath: string;
}
