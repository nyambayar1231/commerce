// Adapted from saleor-dashboard: src/modeling/components/PageDetailsPage/form.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor drives this with its generic useForm, the EditorJS rich-text context, page types and
// attributes; ours keeps the three fields in local state (the content as plain text, see the
// category page's ../../categories/description.ts), with the same rules: Save is enabled only with
// unsaved changes, and a dirty form registers with the exit-form dialog. As on the collection page,
// Save stays enabled on a blank title so the API's REQUIRED error shows under the field — the API is
// the authority either way. A new page (Saleor's PageCreate) starts published, as Saleor's form
// does. When the page changes on the server (after a save), the form takes the new values.
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";

import type { OutputData } from "../../../categories/components/CreateCategoryDialog/CreateCategoryDialog";
import { editorJsToPlainText, plainTextToEditorJs } from "../../../categories/description";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type { PageDetailsFragment } from "../../../graphql/types.generated";
import {
  buildPageSaveComposition,
  hasPageSaveComposition,
  type PageSaveComposition,
} from "./saveComposition";

export interface PageData {
  title: string;
  /** Plain text; converted to EditorJS on submit. */
  content: string;
  isPublished: boolean;
}

export interface PageSubmitData {
  title: string;
  content: OutputData | null;
  isPublished: boolean;
}

export interface UsePageFormResult {
  data: PageData;
  change: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  changeIsPublished: (isPublished: boolean) => void;
  submit: () => Promise<unknown>;
  hasUnsavedChanges: boolean;
  isSaveDisabled: boolean;
  saveComposition: PageSaveComposition;
}

const getInitialData = (page: PageDetailsFragment | undefined | null): PageData => ({
  title: page?.title ?? "",
  content: editorJsToPlainText(page?.content),
  isPublished: page ? page.isPublished : true,
});

/** The form data → `pageCreate` / `pageUpdate` input mapping. */
export const getPageSubmitData = (data: PageData): PageSubmitData => ({
  title: data.title.trim(),
  content: plainTextToEditorJs(data.content),
  isPublished: data.isPublished,
});

export function usePageForm(
  page: PageDetailsFragment | undefined | null,
  onSubmit: (data: PageSubmitData) => Promise<unknown[]>,
  disabled: boolean,
): UsePageFormResult {
  const initial = useMemo(() => getInitialData(page), [page]);
  const [data, setData] = useState(initial);
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const changedFields = (Object.keys(data) as (keyof PageData)[]).filter(
    (key) => data[key] !== initial[key],
  );
  const saveComposition = buildPageSaveComposition(
    changedFields,
    changedFields.includes("content"),
  );
  const hasUnsavedChanges = hasPageSaveComposition(saveComposition);
  const isSaveDisabled = disabled || !hasUnsavedChanges;

  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  });

  const change: UsePageFormResult["change"] = (event) => {
    const { name, value } = event.target;

    if (name in data) {
      setData((current) => ({ ...current, [name]: value }));
    }
  };

  const changeIsPublished: UsePageFormResult["changeIsPublished"] = (isPublished) => {
    setData((current) => ({ ...current, isPublished }));
  };

  const submit = async () => {
    if (isSaveDisabled) {
      return [];
    }

    setIsSubmitting(true);

    try {
      return await onSubmit(getPageSubmitData(data));
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
