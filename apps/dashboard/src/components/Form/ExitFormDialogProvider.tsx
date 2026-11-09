// Adapted from saleor-dashboard: src/components/Form/ExitFormDialogProvider.tsx and
// src/components/Form/useExitFormDialogProvider.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor blocks navigation with React Router 5's `history.block` and re-pushes the location after
// a blocked back/forward; React Router 7's `useBlocker` (needs the data router, see App.tsx) holds
// the transition itself, so "Keep editing" is `reset()` and "Ignore changes" is `proceed()`.
// Same rules: block in-app navigation while a registered form is dirty, except a dialog-only query
// change on the same page; reloading or closing the tab asks the browser's own prompt.
import { createContext, type ReactNode, useCallback, useMemo, useRef } from "react";
import { useBlocker } from "react-router";

import ExitFormDialog from "./ExitFormDialog";
import { isDialogOnlyQueryChange } from "./isDialogOnlyQueryChange";
import type { ExitFormDialogData, FormId } from "./types";
import useBeforeUnload from "./useBeforeUnload";

// Do not use this context directly in components; use the useExitFormDialog hook instead.
export const ExitFormDialogContext = createContext<ExitFormDialogData>({
  setIsDirty: () => undefined,
  unregisterForm: () => undefined,
  setIsSubmitting: () => undefined,
  resetFormsState: () => undefined,
});

const normalizePathname = (pathname: string) => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
};

const ExitFormDialogProvider = ({ children }: { children: ReactNode }) => {
  const dirtyForms = useRef(new Map<FormId, boolean>());
  const isSubmitting = useRef(false);

  const hasDirtyForm = useCallback(
    () => !isSubmitting.current && [...dirtyForms.current.values()].some(Boolean),
    [],
  );

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!hasDirtyForm()) {
      return false;
    }

    const samePage =
      normalizePathname(currentLocation.pathname) === normalizePathname(nextLocation.pathname);

    return !(samePage && isDialogOnlyQueryChange(currentLocation.search, nextLocation.search));
  });

  useBeforeUnload((e) => {
    // Only for real document unload (refresh, tab close). In-app navigation is
    // handled by the blocker and shows the dashboard modal instead.
    if (hasDirtyForm()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  const providerData = useMemo<ExitFormDialogData>(
    () => ({
      setIsDirty: (id, isDirty) => {
        dirtyForms.current.set(id, isDirty);
      },
      unregisterForm: (id) => {
        dirtyForms.current.delete(id);
      },
      setIsSubmitting: (value) => {
        isSubmitting.current = value;
      },
      resetFormsState: () => {
        dirtyForms.current.clear();
      },
    }),
    [],
  );

  return (
    <ExitFormDialogContext.Provider value={providerData}>
      <ExitFormDialog
        isOpen={blocker.state === "blocked"}
        onLeave={() => {
          dirtyForms.current.clear();
          blocker.proceed?.();
        }}
        onClose={() => blocker.reset?.()}
      />
      {children}
    </ExitFormDialogContext.Provider>
  );
};

export default ExitFormDialogProvider;
