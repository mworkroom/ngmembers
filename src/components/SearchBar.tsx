import { SearchIcon } from "./Icons";
import { labels } from "../content/labels";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <section className="search-panel">
      <div className="search-wrap">
        <SearchIcon />
        <input
          value={value}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder={labels.search.placeholder}
          aria-label={labels.search.ariaLabel}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            className="search-clear-button"
            aria-label={labels.search.clearAriaLabel}
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
    </section>
  );
}
