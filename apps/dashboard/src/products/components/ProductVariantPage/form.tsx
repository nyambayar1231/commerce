// Adapted from saleor-dashboard: src/products/components/ProductVariantPage/form.tsx and
// src/products/components/ProductVariantCreatePage/form.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variant pages' form state: name, SKU, track inventory, the single channel's price and the
// per-warehouse stock rows. Ours keeps the fields in local state (Saleor uses its generic useForm,
// attributes, media and channel listings); the stocks follow Saleor's formset: rows are added by
// warehouse, quantity is typed as text, and a save diffs them into add/update/remove stock inputs.
// Save is disabled while loading, without a price, and (on the edit page) with no unsaved changes;
// a dirty form registers with the exit-form dialog. Anything except name, SKU and price is surfaced
// as a notification by the page, not on an input.
import type * as React from "react";
import { useEffect, useState } from "react";

import { useExitFormDialog } from "../../../components/Form/useExitFormDialog";
import type {
  ProductErrorFragment,
  ProductVariantDetailsFragment,
} from "../../../graphql/types.generated";

/** One warehouse's stock in the Inventory card; the quantity is kept as typed. */
export interface ProductVariantStock {
  warehouseId: string;
  warehouseName: string;
  quantityAllocated: number;
  /** An empty value is sent as 0 (Saleor's mapFormsetStockToStockInput). */
  quantity: string;
}

/** A stock row as the stock mutations take it (Saleor's StockInput). */
export interface VariantStockInput {
  warehouse: string;
  quantity: number;
}

export interface ProductVariantStockDiff {
  addStocks: VariantStockInput[];
  updateStocks: VariantStockInput[];
  removeStocks: string[];
}

export interface ProductVariantFormData {
  name: string;
  sku: string;
  trackInventory: boolean;
  /** The price as typed; an empty value never leaves the form (Save is disabled). */
  price: string;
  stocks: ProductVariantStock[];
}

export interface ProductVariantUpdateData {
  name: string;
  sku: string;
  trackInventory: boolean;
  price: string;
}

export interface ProductVariantCreateData extends ProductVariantUpdateData {
  product: string;
  stocks: VariantStockInput[];
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
  stocks: [...(variant?.stocks ?? [])]
    .sort((left, right) => left.warehouse.name.localeCompare(right.warehouse.name))
    .map((stock) => ({
      warehouseId: stock.warehouse.id,
      warehouseName: stock.warehouse.name,
      quantityAllocated: stock.quantityAllocated,
      quantity: String(stock.quantity),
    })),
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
  stocks: data.stocks.map(({ warehouseId, quantity }) => ({
    warehouse: warehouseId,
    quantity: Number(quantity) || 0,
  })),
});

/**
 * Saleor's arrayDiff over the variant's warehouse ids: a warehouse the variant has no stock row in
 * is created, every kept row is updated (Saleor sends them all, not only the changed ones), and a
 * row whose warehouse is gone from the form is deleted. A removed warehouse that is added back is
 * a kept row again, so it is updated rather than created.
 */
export const getStockDiff = (
  variant: ProductVariantDetailsFragment | null | undefined,
  stocks: ProductVariantStock[],
): ProductVariantStockDiff => {
  const existingWarehouseIds = (variant?.stocks ?? []).map((stock) => stock.warehouse.id);
  const formWarehouseIds = stocks.map((stock) => stock.warehouseId);
  const added = formWarehouseIds.filter((id) => !existingWarehouseIds.includes(id));
  const toInput = ({ warehouseId, quantity }: ProductVariantStock): VariantStockInput => ({
    warehouse: warehouseId,
    quantity: Number(quantity) || 0,
  });

  return {
    addStocks: stocks.filter((stock) => added.includes(stock.warehouseId)).map(toInput),
    updateStocks: stocks.filter((stock) => !added.includes(stock.warehouseId)).map(toInput),
    removeStocks: existingWarehouseIds.filter((id) => !formWarehouseIds.includes(id)),
  };
};

/** Stock edits count as unsaved changes: rows compare by warehouse and typed quantity. */
const areStocksEqual = (left: ProductVariantStock[], right: ProductVariantStock[]): boolean =>
  left.length === right.length &&
  left.every((stock) => {
    const initial = right.find((candidate) => candidate.warehouseId === stock.warehouseId);

    return initial !== undefined && initial.quantity === stock.quantity;
  });

export interface UseProductVariantFormResult {
  data: ProductVariantFormData;
  change: (event: React.ChangeEvent<HTMLInputElement>) => void;
  changeTrackInventory: (trackInventory: boolean) => void;
  changeStock: (warehouseId: string, value: string) => void;
  addStock: (warehouseId: string, warehouseName: string) => void;
  removeStock: (warehouseId: string) => void;
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

  const hasUnsavedChanges =
    data.name !== initialData.name ||
    data.sku !== initialData.sku ||
    data.trackInventory !== initialData.trackInventory ||
    data.price !== initialData.price ||
    !areStocksEqual(data.stocks, initialData.stocks);
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

  /** Saleor's quantity input: only digits, or empty while the user clears the field. */
  const changeStock: UseProductVariantFormResult["changeStock"] = (warehouseId, value) => {
    if (value !== "" && !/^\d+$/.test(value)) {
      return;
    }

    setData((current) => ({
      ...current,
      stocks: current.stocks.map((stock) =>
        stock.warehouseId === warehouseId ? { ...stock, quantity: value } : stock,
      ),
    }));
  };

  /** Saleor's handleStockAdd: the allocated quantity comes from the variant's existing row. */
  const addStock: UseProductVariantFormResult["addStock"] = (warehouseId, warehouseName) => {
    setData((current) => {
      if (current.stocks.some((stock) => stock.warehouseId === warehouseId)) {
        return current;
      }

      return {
        ...current,
        stocks: [
          ...current.stocks,
          {
            warehouseId,
            warehouseName,
            quantityAllocated:
              initialData.stocks.find((stock) => stock.warehouseId === warehouseId)
                ?.quantityAllocated ?? 0,
            quantity: "0",
          },
        ],
      };
    });
  };

  const removeStock: UseProductVariantFormResult["removeStock"] = (warehouseId) => {
    setData((current) => ({
      ...current,
      stocks: current.stocks.filter((stock) => stock.warehouseId !== warehouseId),
    }));
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
    changeStock,
    addStock,
    removeStock,
    submit,
    hasUnsavedChanges,
    isSaveDisabled,
  };
}
