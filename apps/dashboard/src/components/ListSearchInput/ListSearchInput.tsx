// Adapted from saleor-dashboard: src/components/ListSearchInput/ListSearchInput.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor debounces with its <Debounce> render-prop component (500 ms); this is the same timer as a
// ref. Saleor's search-syntax tooltip is left out (our search is plain substring matching).
import { Search } from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react";

import styles from "./ListSearchInput.module.css";

const DEBOUNCE_MS = 500;

interface ListSearchInputProps {
  initialSearch: string;
  placeholder: string;
  onSearchChange: (value: string) => void;
}

export const ListSearchInput = ({
  initialSearch,
  placeholder,
  onSearchChange,
}: ListSearchInputProps): ReactNode => {
  const [search, setSearch] = useState(initialSearch);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    function syncSearchFromUrl() {
      setSearch(initialSearch);
    },
    [initialSearch],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setSearch(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearchChange(value), DEBOUNCE_MS);
  };

  return (
    <div className={styles.wrapper} data-test-id="list-search-field">
      <Search size={16} color="var(--mu-colors-text-default2)" />
      <input
        type="text"
        value={search}
        onChange={handleChange}
        placeholder={placeholder}
        className={styles.input}
        data-test-id="search-input"
      />
    </div>
  );
};

ListSearchInput.displayName = "ListSearchInput";
