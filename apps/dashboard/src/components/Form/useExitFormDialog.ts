// Adapted from saleor-dashboard: src/components/Form/useExitFormDialog.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useContext, useEffect, useRef } from "react";

import { ExitFormDialogContext } from "./ExitFormDialogProvider";
import type { FormId } from "./types";

export interface UseExitFormDialogResult {
  formId: FormId;
  setIsDirty: (isDirty: boolean) => void;
  setIsSubmitting: (value: boolean) => void;
  resetFormsState: () => void;
}

/** Registers one form with the exit-form dialog; the form unregisters when it unmounts. */
export const useExitFormDialog = (formId?: FormId): UseExitFormDialogResult => {
  const id = useRef(formId ?? Symbol("exit-form-fallback-id")).current;
  const { setIsDirty, unregisterForm, setIsSubmitting, resetFormsState } =
    useContext(ExitFormDialogContext);

  useEffect(() => () => unregisterForm(id), [id, unregisterForm]);

  return {
    formId: id,
    setIsDirty: (value: boolean) => setIsDirty(id, value),
    setIsSubmitting,
    resetFormsState,
  };
};
