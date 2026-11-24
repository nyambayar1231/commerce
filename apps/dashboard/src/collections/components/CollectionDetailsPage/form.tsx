// Adapted from saleor-dashboard: src/collections/components/CollectionDetailsPage/form.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor drives this with its generic useForm, the EditorJS rich-text context and channel listings;
// ours keeps the three fields in local state (the description as plain text, see the category
// page's ../../categories/description.ts), with the same rules: Save is enabled only with unsaved
// changes, and a dirty form registers with the exit-form dialog. Unlike Saleor (and like the create
// dialog), Save stays enabled on a blank name so the API's REQUIRED error shows under the field —
// the API is the authority either way. When the collection changes on the server (after a save), the
// form takes the new values.
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";

import type { OutputData } from "../../../categories/components/CreateCategoryDialog/CreateCategoryDialog";
import { editorJsToPlainText, plainTextToEditorJs } from "../../../categories/description";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type { CollectionDetailsFragment } from "../../../graphql/types.generated";
import {
  buildCollectionSaveComposition,
  type CollectionSaveComposition,
  hasCollectionSaveComposition,
} from "./saveComposition";

export interface CollectionUpdateFormData {
  name: string;
  /** Plain text; converted to EditorJS on submit. */
  description: string;
  isPublished: boolean;
}

export interface CollectionUpdateData {
  name: string;
  description: OutputData | null;
  isPublished: boolean;
}

export interface UseCollectionUpdateFormResult {
  data: CollectionUpdateFormData;
  change: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  changeIsPublished: (isPublished: boolean) => void;
  submit: () => Promise<unknown>;
  hasUnsavedChanges: boolean;
  isSaveDisabled: boolean;
  saveComposition: CollectionSaveComposition;
}

const getInitialData = (
  collection: CollectionDetailsFragment | undefined | null,
): CollectionUpdateFormData => ({
  name: collection?.name ?? "",
  description: editorJsToPlainText(collection?.description),
  isPublished: collection?.isPublished ?? false,
});

/** The form data → `collectionUpdate` input mapping. */
export const getCollectionUpdateData = (data: CollectionUpdateFormData): CollectionUpdateData => ({
  name: data.name.trim(),
  description: plainTextToEditorJs(data.description),
  isPublished: data.isPublished,
});

export function useCollectionUpdateForm(
  collection: CollectionDetailsFragment | undefined | null,
  onSubmit: (data: CollectionUpdateData) => Promise<unknown[]>,
  disabled: boolean,
): UseCollectionUpdateFormResult {
  const initial = useMemo(() => getInitialData(collection), [collection]);
  const [data, setData] = useState(initial);
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const changedFields = (Object.keys(data) as (keyof CollectionUpdateFormData)[]).filter(
    (key) => data[key] !== initial[key],
  );
  const saveComposition = buildCollectionSaveComposition(
    changedFields,
    changedFields.includes("description"),
  );
  const hasUnsavedChanges = hasCollectionSaveComposition(saveComposition);
  const isSaveDisabled = disabled || !hasUnsavedChanges;

  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  });

  const change: UseCollectionUpdateFormResult["change"] = (event) => {
    const { name, value } = event.target;

    if (name in data) {
      setData((current) => ({ ...current, [name]: value }));
    }
  };

  const changeIsPublished: UseCollectionUpdateFormResult["changeIsPublished"] = (isPublished) => {
    setData((current) => ({ ...current, isPublished }));
  };

  const submit = async () => {
    if (isSaveDisabled) {
      return [];
    }

    setIsSubmitting(true);

    try {
      return await onSubmit(getCollectionUpdateData(data));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    data,
    change,
    changeIsPublished,
    submit,
    hasUnsavedChanges,
    isSaveDisabled,
    saveComposition,
  };
}
