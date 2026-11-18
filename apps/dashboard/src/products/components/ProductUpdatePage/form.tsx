// Adapted from saleor-dashboard: src/products/components/ProductUpdatePage/form.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The update page's form state: name, description (plain text), category (global ID) and publish
// status, plus the Variants grid's pending edits. Ours keeps the fields in local state (Saleor uses
// its generic useForm + rich-text context) with the same rules: Save is enabled only with unsaved
// changes and a non-blank name, and a dirty form registers with the exit-form dialog. The page owns
// the grid's change list (Saleor's `datagrid` + DatagridChangeStateContext), so a grid edit makes
// the page dirty and Save sends the product and the variants together; a variant whose calls
// succeed has its edits cleared here. Anything except name, category and isPublished is surfaced as
// a notification by the page, not on an input.
import type * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { editorJsToPlainText, plainTextToEditorJs } from "../../../categories/description";
import {
  type DatagridChange,
  type OnDatagridChange,
  type UseDatagridChangeState,
  useDatagridChangeState,
} from "../../../components/Datagrid/hooks/useDatagridChange";
import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type {
  ProductDetailsFragment,
  ProductErrorFragment,
} from "../../../graphql/types.generated";
import type { VariantGridError } from "../ProductVariants/datagrid";

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

/**
 * What a save reports back: the product form's errors, the variant grid's rejected cells, and the
 * variants whose calls all succeeded (their edits can be cleared).
 */
export interface ProductUpdateSubmitResult {
  errors: ProductErrorFragment[];
  variantErrors: VariantGridError[];
  savedVariantIds: string[];
}

/** Saleor's submit handler: the product form plus the grid's pending edits. */
export type ProductUpdateSubmit = (
  data: ProductUpdateData,
  variantChanges: DatagridChange[],
) => Promise<ProductUpdateSubmitResult>;

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
  /** The Variants grid's change list (DatagridChangeStateContext's value). */
  datagrid: UseDatagridChangeState;
  /** The grid changes not yet saved; a variant's edits leave it once its calls succeed. */
  variantChanges: DatagridChange[];
  /** Saleor's grid `onChange`: every edit updates the pending list, which makes the page dirty. */
  changeVariants: OnDatagridChange;
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
  onSubmit: ProductUpdateSubmit,
  disabled: boolean,
): UseProductUpdateFormResult {
  const initial = useMemo(() => getInitialData(product), [product]);
  const [data, setData] = useState(initial);
  const datagrid = useDatagridChangeState();
  const [variantChanges, setVariantChanges] = useState<DatagridChange[]>([]);
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();

  useEffect(() => {
    setData(initial);
  }, [initial]);

  const changedFields = (Object.keys(data) as (keyof ProductUpdateFormData)[]).filter(
    (key) => data[key] !== initial[key],
  );
  const saveComposition = buildProductSaveComposition(changedFields);
  const hasUnsavedChanges = hasProductSaveComposition(saveComposition) || variantChanges.length > 0;
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

  const changeVariants: OnDatagridChange = useCallback(({ updates }) => {
    setVariantChanges(updates);
  }, []);

  const submit = async () => {
    if (isSaveDisabled) {
      return [];
    }

    setIsSubmitting(true);

    try {
      const result = await onSubmit(getProductUpdateData(data), variantChanges);

      if (result.savedVariantIds.length > 0) {
        const savedIds = new Set(result.savedVariantIds);
        const remaining = datagrid.changes.current.filter((change) => {
          const variant = product?.variants[change.row];

          return variant === undefined || !savedIds.has(variant.id);
        });

        datagrid.changes.current = remaining;
        setVariantChanges(remaining);
      }

      return result.errors;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    data,
    change,
    changeCategory,
    changeIsPublished,
    datagrid,
    variantChanges,
    changeVariants,
    submit,
    hasUnsavedChanges,
    isSaveDisabled,
    saveComposition,
  };
}
