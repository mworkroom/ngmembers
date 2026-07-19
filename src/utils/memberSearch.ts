import type { MemberRecord } from "../types";
import { normalizeLooseText, normalizeSearch } from "./formatters";

export function getSearchRank(
  member: MemberRecord,
  rawQuery: string,
  normalizedQuery = normalizeSearch(rawQuery)
): number {
  const number = normalizeSearch(member.memberNumber);
  const nickname = normalizeSearch(member.nickname);
  const name = normalizeSearch(member.name);
  const phone = normalizeSearch(member.phone);
  const notes = normalizeSearch(member.notes);

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
  const primaryHaystack = normalizeSearch(
    [member.memberNumber, member.name, member.nickname, member.phone].join(" ")
  );
  if (tokens.length > 0 && tokens.every((token) => primaryHaystack.includes(token))) return 8;
  if (nickname.includes(normalizedQuery)) return 9;
  if (name.includes(normalizedQuery)) return 10;
  if (number.includes(normalizedQuery)) return 11;
  if (
    notes.includes(normalizedQuery) ||
    (tokens.length > 0 && tokens.every((token) => notes.includes(token)))
  ) return 12;
  return 99;
}

export function isExactMemberNumberMatch(
  member: MemberRecord,
  normalizedQuery: string
): boolean {
  return Boolean(normalizedQuery) && normalizeSearch(member.memberNumber) === normalizedQuery;
}
