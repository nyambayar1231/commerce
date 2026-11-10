// Adapted from saleor-dashboard: src/products/components/ProductVariantPage/form.tsx and
// src/products/components/ProductVariantCreatePage/form.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variant pages' form state: name, SKU, track inventory and the single channel's price. Ours
// keeps the fields in local state (Saleor uses its generic useForm, attributes, media, stocks and
// channel listings). Save is disabled while loading, without a price, and (on the edit page) with
// no unsaved changes; a dirty form registers with the exit-form dialog. Anything except name, SKU
// and price is surfaced as a notification by the page, not on an input.
import type * as React from "react";
import { useEffect, useState } from "react";

import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type {
  ProductErrorFragment,
  ProductVariantDetailsFragment,
} from "../../../graphql/types.generated";

export interface ProductVariantFormData {
  name: string;
  sku: string;
  trackInventory: boolean;
  /** The price as typed; an empty value never leaves the form (Save is disabled). */
  price: string;
}

export interface ProductVariantUpdateData {
  name: string;
  sku: string;
  trackInventory: boolean;
  price: string;
}

export interface ProductVariantCreateData extends ProductVariantUpdateData {
  product: string;
}

export interface ProductVariantFormErrors {
  name?: ProductErrorFragment;
  sku?: ProductErrorFragment;
  price?: ProductErrorFragment;
  /** Errors with no input of their own: reported as notifications. */
  other: ProductErrorFragment[];
}

const FIELD_NAMES = ["name", "sku", "price"] as const;

type ProductVariantFormField = (typeof FIELD_NAMES)[number];

const isFormField = (field: string | null): field is ProductVariantFormField =>
  field !== null && (FIELD_NAMES as readonly string[]).includes(field);

/** Saleor's splitSubmitErrors, limited to the page's three inputs. */
export const getProductVariantFormErrors = (
  errors: ProductErrorFragment[],
): ProductVariantFormErrors => {
  const result: ProductVariantFormErrors = { other: [] };

  for (const error of errors) {
    if (isFormField(error.field) && !result[error.field]) {
      result[error.field] = error;
    } else if (!isFormField(error.field)) {
      result.other.push(error);
    }
  }

  return result;
};

/** A variant's stored values as form data; the create page passes no variant. */
export const getProductVariantFormData = (
  variant?: ProductVariantDetailsFragment | null,
): ProductVariantFormData => ({
  name: variant?.name ?? "",
  sku: variant?.sku ?? "",
  trackInventory: variant?.trackInventory ?? true,
  price: variant?.price?.amount === undefined ? "" : String(variant.price.amount),
});

/** The form data → `productVariantUpdate` input mapping. A blank SKU is sent as "". */
export const getProductVariantUpdateData = (
  data: ProductVariantFormData,
): ProductVariantUpdateData => ({
  name: data.name.trim(),
  sku: data.sku,
  trackInventory: data.trackInventory,
  price: data.price,
});

/** The form data → `productVariantCreate` input mapping. */
export const getProductVariantCreateData = (
  productId: string,
  data: ProductVariantFormData,
): ProductVariantCreateData => ({
  product: productId,
  ...getProductVariantUpdateData(data),
});

export interface UseProductVariantFormResult {
  data: ProductVariantFormData;
  change: (event: React.ChangeEvent<HTMLInputElement>) => void;
  changeTrackInventory: (trackInventory: boolean) => void;
  submit: () => Promise<unknown>;
  hasUnsavedChanges: boolean;
  isSaveDisabled: boolean;
}

export function useProductVariantForm(
  initialData: ProductVariantFormData,
  onSubmit: (data: ProductVariantFormData) => Promise<unknown[]>,
  disabled: boolean,
  /** The edit page's Save only applies unsaved changes; the create page always starts empty. */
  requireChanges: boolean,
): UseProductVariantFormResult {
  const [data, setData] = useState(initialData);
  const { setIsDirty, setIsSubmitting } = useExitFormDialog();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const changedFields = (Object.keys(data) as (keyof ProductVariantFormData)[]).filter(
    (key) => data[key] !== initialData[key],
  );
  const hasUnsavedChanges = changedFields.length > 0;
  const isSaveDisabled = disabled || !data.price.trim() || (requireChanges && !hasUnsavedChanges);

  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  });

  const change: UseProductVariantFormResult["change"] = (event) => {
    const { name, value } = event.target;

    if (name === "name" || name === "sku" || name === "price") {
      setData((current) => ({ ...current, [name]: value }));
    }
  };

  const changeTrackInventory: UseProductVariantFormResult["changeTrackInventory"] = (
    trackInventory,
  ) => {
    setData((current) => ({ ...current, trackInventory }));
  };

  const submit = async () => {
    if (isSaveDisabled) {
      return [];
    }

    setIsSubmitting(true);

    try {
      return await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    data,
    change,
    changeTrackInventory,
    submit,
    hasUnsavedChanges,
    isSaveDisabled,
  };
}
