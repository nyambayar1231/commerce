// Adapted from saleor-dashboard: src/categories/components/CategoryUpdatePage/form.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor drives this with its generic useForm + the EditorJS rich-text context; ours keeps the two
// fields in local state (the description as plain text, see ../../description.ts), with the same
// rules: Save is enabled only with unsaved changes and a non-blank name, and a dirty form registers
// with the exit-form dialog. When the category changes on the server (after a save), the form
// takes the new values.
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";

import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type { CategoryDetailsFragment } from "../../../graphql/types.generated";
import { editorJsToPlainText, plainTextToEditorJs } from "../../description";
import type { OutputData } from "../CreateCategoryDialog/CreateCategoryDialog";
import {
  buildCategorySaveComposition,
  type CategorySaveComposition,
  hasCategorySaveComposition,
} from "./saveComposition";

export interface CategoryUpdateFormData {
  name: string;
  /** Plain text; converted to EditorJS on submit. */
  description: string;
}

export interface CategoryUpdateData {
  name: string;
  description: OutputData | null;
}

export interface UseCategoryUpdateFormResult {
  data: CategoryUpdateFormData;
  change: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  submit: () => Promise<unknown>;
  hasUnsavedChanges: boolean;
  isSaveDisabled: boolean;
  saveComposition: CategorySaveComposition;
}

const getInitialData = (
  category: CategoryDetailsFragment | undefined | null,
): CategoryUpdateFormData => ({
  name: category?.name ?? "",
  description: editorJsToPlainText(category?.description),
});

export function useCategoryUpdateForm(
  category: CategoryDetailsFragment | undefined | null,
  onSubmit: (data: CategoryUpdateData) => Promise<unknown[]>,
  disabled: boolean,
): UseCategoryUpdateFormResult {
  const initial = useMemo(() => getInitialData(category), [category]);
  const [data, setData] = useState(initial);
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const changedFields = (Object.keys(data) as (keyof CategoryUpdateFormData)[]).filter(
    (key) => data[key] !== initial[key],
  );
  const saveComposition = buildCategorySaveComposition(
    changedFields,
    changedFields.includes("description"),
  );
  const hasUnsavedChanges = hasCategorySaveComposition(saveComposition);
  const isSaveDisabled = disabled || !hasUnsavedChanges || !data.name.trim();

  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  });

  const change: UseCategoryUpdateFormResult["change"] = (event) => {
    const { name, value } = event.target;

    if (name in data) {
      setData((current) => ({ ...current, [name]: value }));
    }
  };

  const submit = async () => {
    if (isSaveDisabled) {
      return [];
    }

    setIsSubmitting(true);

    try {
      return await onSubmit({
        name: data.name.trim(),
        description: plainTextToEditorJs(data.description),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { data, change, submit, hasUnsavedChanges, isSaveDisabled, saveComposition };
}
