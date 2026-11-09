// Copied from saleor-dashboard: src/components/Form/useBeforeUnload.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useEffect, useRef } from "react";

const useBeforeUnload = (fn: (event: BeforeUnloadEvent) => void) => {
  const cb = useRef(fn);

  useEffect(() => {
    cb.current = fn;
  }, [fn]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => cb.current?.(event);

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
};

export default useBeforeUnload;
