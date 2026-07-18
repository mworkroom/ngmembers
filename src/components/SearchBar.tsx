import { SearchIcon } from "./Icons";

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
          placeholder="이름·닉네임·회원번호·전화번호"
          aria-label="회원 검색"
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            className="search-clear-button"
            aria-label="검색어 지우기"
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
    </section>
  );
}
