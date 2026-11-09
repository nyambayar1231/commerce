// Adapted from saleor-dashboard: src/components/Form/types.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's context also stores each form's submit function and per-form dialog-close blocking;
// nothing here uses them yet.
export type FormId = symbol;

export interface ExitFormDialogData {
  setIsDirty: (id: FormId, isDirty: boolean) => void;
  unregisterForm: (id: FormId) => void;
  /** While true (a save or delete is running), navigation is never blocked. */
  setIsSubmitting: (value: boolean) => void;
  /** Forget every form's dirty state, e.g. before navigating away after a delete. */
  resetFormsState: () => void;
}
