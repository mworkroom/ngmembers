import type { MainFilter } from "../types";
import { labels } from "../content/labels";

interface FilterTabsProps {
  value: MainFilter;
  counts: Record<MainFilter, number>;
  onChange: (value: MainFilter) => void;
}

const tabs: Array<{ value: MainFilter; label: string }> = [
  { value: "all", label: labels.filters.all },
  { value: "anchor", label: labels.filters.anchor },
  { value: "favorite", label: labels.filters.favorite }
];

export function FilterTabs({ value, counts, onChange }: FilterTabsProps) {
  return (
    <div className="filter-tabs" role="tablist" aria-label={labels.filters.ariaLabel}>
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
