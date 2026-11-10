// Adapted from saleor-dashboard: src/hooks/useDebounce.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Debounces a callback and clears the pending timer on unmount. The filter panel uses it to
// search category options only after typing pauses.
import { useEffect, useRef } from "react";

export type UseDebounceFn<T> = (...args: T[]) => void;

function useDebounce<T>(debounceFn: UseDebounceFn<T>, time = 200): UseDebounceFn<T> {
  const timer = useRef<number | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current as number), []);

  return (...args: T[]) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = window.setTimeout(() => debounceFn(...args), time);
  };
}

export default useDebounce;
