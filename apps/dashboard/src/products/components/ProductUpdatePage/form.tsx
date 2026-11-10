// Adapted from saleor-dashboard: src/products/components/ProductUpdatePage/form.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The update page's form state: name, description (plain text), category (global ID) and publish
// status. Ours keeps the fields in local state (Saleor uses its generic useForm + rich-text
// context) with the same rules: Save is enabled only with unsaved changes and a non-blank name,
// and a dirty form registers with the exit-form dialog. Anything except name, category and
// isPublished is surfaced as a notification by the page, not on an input.
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { editorJsToPlainText, plainTextToEditorJs } from "../../../categories/description";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type {
  ProductDetailsFragment,
  ProductErrorFragment,
} from "../../../graphql/types.generated";

export interface ProductUpdateFormData {
  name: string;
  /** Plain text; converted to EditorJS on submit. */
  description: string;
  /** Global ID, or null when the product has no category. */
  category: string | null;
  isPublished: boolean;
}

export type ProductDescription = ReturnType<typeof plainTextToEditorJs>;

export interface ProductUpdateData {
  name: string;
  description: ProductDescription;
  category: string | null;
  isPublished: boolean;
}

export interface ProductSaveComposition {
  hasDetails: boolean;
}

export const buildProductSaveComposition = (
  changedFieldNames: ReadonlyArray<string>,
): ProductSaveComposition => ({
  hasDetails: changedFieldNames.length > 0,
});

export const hasProductSaveComposition = (composition: ProductSaveComposition): boolean =>
  composition.hasDetails;

export const EMPTY_PRODUCT_SAVE_COMPOSITION: ProductSaveComposition = {
  hasDetails: false,
};

export interface ProductUpdateFormErrors {
  name?: ProductErrorFragment;
  category?: ProductErrorFragment;
  isPublished?: ProductErrorFragment;
  /** Errors with no input of their own: reported as notifications. */
  other: ProductErrorFragment[];
}

const FIELD_NAMES = ["name", "category", "isPublished"] as const;

type ProductUpdateFormField = (typeof FIELD_NAMES)[number];

const isFormField = (field: string | null): field is ProductUpdateFormField =>
  field !== null && (FIELD_NAMES as readonly string[]).includes(field);

/** Saleor's splitSubmitErrors, limited to the page's three inputs. */
export const getProductUpdateFormErrors = (
  errors: ProductErrorFragment[],
): ProductUpdateFormErrors => {
  const result: ProductUpdateFormErrors = { other: [] };

  for (const error of errors) {
    if (isFormField(error.field) && !result[error.field]) {
      result[error.field] = error;
    } else if (!isFormField(error.field)) {
      result.other.push(error);
    }
  }

  return result;
};

/** The form data → `productUpdate` input mapping. */
export const getProductUpdateData = (data: ProductUpdateFormData): ProductUpdateData => ({
  name: data.name.trim(),
  description: plainTextToEditorJs(data.description),
  category: data.category,
  isPublished: data.isPublished,
});

export interface UseProductUpdateFormResult {
  data: ProductUpdateFormData;
  change: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  changeCategory: (category: string | null) => void;
  changeIsPublished: (isPublished: boolean) => void;
  submit: () => Promise<unknown>;
  hasUnsavedChanges: boolean;
  isSaveDisabled: boolean;
  saveComposition: ProductSaveComposition;
}

const getInitialData = (
  product: ProductDetailsFragment | undefined | null,
): ProductUpdateFormData => ({
  name: product?.name ?? "",
  description: editorJsToPlainText(product?.description),
  category: product?.category?.id ?? null,
  isPublished: product?.isPublished ?? false,
});

export function useProductUpdateForm(
  product: ProductDetailsFragment | undefined | null,
  onSubmit: (data: ProductUpdateData) => Promise<unknown[]>,
  disabled: boolean,
): UseProductUpdateFormResult {
  const initial = useMemo(() => getInitialData(product), [product]);
  const [data, setData] = useState(initial);
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const changedFields = (Object.keys(data) as (keyof ProductUpdateFormData)[]).filter(
    (key) => data[key] !== initial[key],
  );
  const saveComposition = buildProductSaveComposition(changedFields);
  const hasUnsavedChanges = hasProductSaveComposition(saveComposition);
  const isSaveDisabled = disabled || !hasUnsavedChanges || !data.name.trim();

  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  });

  const change: UseProductUpdateFormResult["change"] = (event) => {
    const { name, value } = event.target;

    if (name === "name" || name === "description") {
      setData((current) => ({ ...current, [name]: value }));
    }
  };

  const changeCategory: UseProductUpdateFormResult["changeCategory"] = (category) => {
    setData((current) => ({ ...current, category }));
  };

  const changeIsPublished: UseProductUpdateFormResult["changeIsPublished"] = (isPublished) => {
    setData((current) => ({ ...current, isPublished }));
  };

  const submit = async () => {
    if (isSaveDisabled) {
      return [];
    }

    setIsSubmitting(true);

    try {
      return await onSubmit(getProductUpdateData(data));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    data,
    change,
    changeCategory,
    changeIsPublished,
    submit,
    hasUnsavedChanges,
    isSaveDisabled,
    saveComposition,
  };
}
