import { useMemo, useState } from "react";
import type { MemberRecord } from "../types";
import {
  compareMemberNumbers,
  displayName,
  normalizeSearch
} from "../utils/formatters";

interface MemberPickerProps {
  label: string;
  members: MemberRecord[];
  selectedId: string | null;
  excludeId?: string | null;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  onChange: (memberId: string | null) => void;
}

export function MemberPicker({
  label,
  members,
  selectedId,
  excludeId,
  placeholder = "이름·닉네임·회원번호로 검색",
  hint,
  disabled = false,
  onChange
}: MemberPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = members.find((member) => member.id === selectedId) ?? null;

  const results = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];

    return members
      .filter((member) => member.id !== excludeId)
      .map((member) => ({
        member,
        rank: getPickerRank(member, normalized)
      }))
      .filter((item) => item.rank < 99)
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          compareMemberNumbers(a.member.memberNumber, b.member.memberNumber)
      )
      .slice(0, 8)
      .map((item) => item.member);
  }, [excludeId, members, query]);

  return (
    <div className="member-picker">
      <span className="field-label">{label}</span>
      {selected ? (
        <div className="picker-selected">
          <div>
            <strong>{displayName(selected)}</strong>
            <span>
              {selected.nickname ? `${selected.nickname} · ` : ""}
              {selected.memberNumber}
            </span>
          </div>
          <button
            type="button"
            disabled={disabled}
            aria-label={`${label} 선택 해제`}
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(false);
            }}
          >
            ×
          </button>
        </div>
      ) : (
        <div className="picker-search">
          <input
            value={query}
            type="search"
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
          />
          {open && query ? (
            <div className="picker-results" role="listbox">
              {results.length > 0 ? (
                results.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(member.id);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <strong>{displayName(member)}</strong>
                    <span>
                      {member.nickname ? `${member.nickname} · ` : ""}
                      {member.memberNumber}
                    </span>
                  </button>
                ))
              ) : (
                <p>일치하는 회원이 없습니다.</p>
              )}
            </div>
          ) : null}
        </div>
      )}
      {hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}

function getPickerRank(member: MemberRecord, query: string): number {
  const number = normalizeSearch(member.memberNumber);
  const nickname = normalizeSearch(member.nickname);
  const name = normalizeSearch(member.name);

  if (number === query) return 0;
  if (nickname === query) return 1;
  if (name === query) return 2;
  if (number.startsWith(query)) return 3;
  if (nickname.startsWith(query)) return 4;
  if (name.startsWith(query)) return 5;
  if (nickname.includes(query)) return 6;
  if (name.includes(query)) return 7;
  if (number.includes(query)) return 8;
  return 99;
}
