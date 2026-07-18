import type { MainFilter } from "../types";

interface FilterTabsProps {
  value: MainFilter;
  counts: Record<MainFilter, number>;
  onChange: (value: MainFilter) => void;
}

const tabs: Array<{ value: MainFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "anchor", label: "주요 사업자" },
  { value: "favorite", label: "관심 회원" }
];

export function FilterTabs({ value, counts, onChange }: FilterTabsProps) {
  return (
    <div className="filter-tabs" role="tablist" aria-label="회원 목록 필터">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={value === tab.value ? "active" : ""}
          onClick={() => onChange(tab.value)}
        >
          <span>{tab.label}</span>
          <small>{counts[tab.value]}</small>
        </button>
      ))}
    </div>
  );
}
