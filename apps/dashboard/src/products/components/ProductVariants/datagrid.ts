// Adapted from saleor-dashboard: src/products/components/ProductVariants/datagrid.ts and
// src/products/components/ProductVariants/utils.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variants card's columns, in Saleor's order and widths: name, SKU, price, then one per
// warehouse (Saleor's parseWarehousesColumns) titled with the warehouse's name. Our single channel
// replaces Saleor's per-channel columns, so the price is one MNT cell. Name and SKU are text cells,
// the price and each warehouse cell are number cells (Saleor's money cell for a single 0-decimal
// currency would show the same whole number). A warehouse cell shows the variant's quantity there,
// empty when the variant has no stock row in it. Edits live in the grid's change list until Save.
//
// Also here, because they are pure: the edits → per-variant `productVariantUpdate` input and
// `productVariantStocksUpdate` stocks (only the changed fields, empty SKU sent as ""), and the
// rejected-row errors → the cell each one belongs to.
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import {
  numberCell,
  readonlyTextCell,
  textCell,
} from "../../../components/Datagrid/customCells/cells";
import {
  type NumberCellProps,
  numberCellEmptyValue,
} from "../../../components/Datagrid/customCells/NumberCell";
import type { GetCellContentOpts } from "../../../components/Datagrid/Datagrid";
import type { DatagridChange } from "../../../components/Datagrid/hooks/useDatagridChange";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type {
  BulkStockErrorFragment,
  ProductDetailsFragment,
  ProductErrorFragment,
} from "../../../graphql/types.generated";
import { messages } from "./messages";

export type ProductVariantRow = ProductDetailsFragment["variants"][number];

export const variantsStaticColumns = (intl: IntlShape): AvailableColumn[] => [
  {
    id: "name",
    title: intl.formatMessage(messages.name),
    width: 200,
  },
  {
    id: "sku",
    title: intl.formatMessage(messages.sku),
    width: 200,
  },
  {
    id: "price",
    title: intl.formatMessage(messages.price),
    width: 150,
  },
];

const WAREHOUSE_COLUMN_PREFIX = "warehouse:";

/** The warehouse a column stands for, or null for the static columns. */
export const getColumnWarehouseId = (columnId: string): string | null =>
  columnId.startsWith(WAREHOUSE_COLUMN_PREFIX)
    ? columnId.slice(WAREHOUSE_COLUMN_PREFIX.length)
    : null;

const warehouseColumnId = (warehouseId: string): string =>
  `${WAREHOUSE_COLUMN_PREFIX}${warehouseId}`;

/** Saleor's parseWarehousesColumns: one column per warehouse, keyed by its id. */
export const parseWarehousesColumns = (
  warehouses: { id: string; name: string }[],
): AvailableColumn[] =>
  warehouses.map((warehouse) => ({
    id: warehouseColumnId(warehouse.id),
    title: warehouse.name,
    width: 150,
  }));

const getNumberChange = (change: DatagridChange | undefined): NumberCellProps["value"] | null =>
  change === undefined ? null : ((change.data as NumberCellProps | undefined)?.value ?? null);

const getTextChange = (change: DatagridChange | undefined): string | null =>
  typeof change?.data === "string" ? change.data : null;

export const createGetCellContent =
  (rows: ProductVariantRow[], columns: AvailableColumn[]) =>
  ([column, row]: Item, { changes, getChangeIndex }: GetCellContentOpts): GridCell => {
    const columnId = columns[column]?.id;
    const variant = rows[row];

    if (!columnId || !variant) {
      return readonlyTextCell("", false);
    }

    const change = changes.current[getChangeIndex(columnId, row)];
    const warehouseId = getColumnWarehouseId(columnId);

    if (warehouseId !== null) {
      const stock = (variant.stocks ?? []).find((item) => item.warehouse.id === warehouseId);

      return numberCell(getNumberChange(change) ?? stock?.quantity ?? numberCellEmptyValue);
    }

    switch (columnId) {
      case "name":
        return textCell(getTextChange(change) ?? variant.name);
      case "sku":
        return textCell(getTextChange(change) ?? variant.sku ?? "");
      case "price":
        return numberCell(getNumberChange(change) ?? variant.price.amount);
      default:
        return readonlyTextCell("", false);
    }
  };

/** One variant's grid edits as the save sends them: one `productVariantUpdate`, then these stocks. */
export interface VariantGridUpdate {
  id: string;
  input: {
    name?: string;
    sku?: string;
    /** `Decimal` in the API: the MNT amount as a string (ADR-0013, no minor units). */
    price?: string;
  };
  stocks: { warehouse: string; quantity: number }[];
}

/**
 * A cell a rejected row keeps tinted red: the variant it belongs to and the column's id
 * ("name", "sku", "price" or "warehouse:<id>").
 */
export interface VariantGridError {
  variantId: string;
  columnId: string;
}

const NUMBER_COLUMNS = ["price"] as const;

/**
 * A price or stock cell's edit is a whole number ≥ 0; anything else never reaches the API. A
 * cleared cell (Saleor's `numberCellEmptyValue`) holds no number: it is never sent either, but it
 * is not a mistake to fix, so it is not marked as an error (we have no "remove the stock" step yet).
 */
export const isValidVariantGridNumber = (
  columnId: string,
  change: DatagridChange | undefined,
): boolean => {
  if (change === undefined || !isVariantGridNumberColumn(columnId)) {
    return true;
  }

  const value = getNumberChange(change);

  if (value === numberCellEmptyValue) {
    return true;
  }

  return typeof value === "number" && Number.isInteger(value) && value >= 0;
};

export const isVariantGridNumberColumn = (columnId: string): boolean =>
  getColumnWarehouseId(columnId) !== null ||
  (NUMBER_COLUMNS as readonly string[]).includes(columnId);

/** The grid's invalid number cells, as the red cells the user has to fix before saving. */
export const getInvalidVariantGridErrors = (
  variants: ProductVariantRow[],
  changes: DatagridChange[],
): VariantGridError[] =>
  changes.flatMap((change) => {
    const variant = variants[change.row];

    if (!variant || isValidVariantGridNumber(change.column, change)) {
      return [];
    }

    return [{ variantId: variant.id, columnId: change.column }];
  });

/**
 * Saleor's getBulkVariantUpdateInputs, one variant at a time and only the changed fields: the
 * grid's changes grouped by row and mapped to the input each call needs. A variant with an invalid
 * cell is left out (it keeps its changes); an empty SKU is sent as "" (Saleor's clear).
 */
export const getVariantGridUpdates = (
  variants: ProductVariantRow[],
  changes: DatagridChange[],
): VariantGridUpdate[] => {
  const invalidVariantIds = new Set(
    getInvalidVariantGridErrors(variants, changes).map((error) => error.variantId),
  );
  const updates = new Map<number, VariantGridUpdate>();

  for (const change of [...changes].sort((left, right) => left.row - right.row)) {
    const variant = variants[change.row];

    if (!variant || invalidVariantIds.has(variant.id)) {
      continue;
    }

    const update = updates.get(change.row) ?? { id: variant.id, input: {}, stocks: [] };
    const warehouseId = getColumnWarehouseId(change.column);

    if (warehouseId !== null) {
      const quantity = getNumberChange(change);

      if (typeof quantity === "number") {
        update.stocks.push({ warehouse: warehouseId, quantity });
      }
    } else if (change.column === "name" || change.column === "sku") {
      update.input[change.column] = getTextChange(change) ?? "";
    } else if (change.column === "price") {
      const price = getNumberChange(change);

      if (typeof price === "number") {
        update.input.price = String(price);
      }
    }

    updates.set(change.row, update);
  }

  return [...updates.values()].filter(
    (update) => Object.keys(update.input).length > 0 || update.stocks.length > 0,
  );
};

/** `productVariantUpdate` field errors → the cells they belong to (name, SKU, price). */
export const getVariantFieldErrors = (
  variantId: string,
  errors: Pick<ProductErrorFragment, "field">[],
): VariantGridError[] =>
  errors.flatMap((error) =>
    error.field === "name" || error.field === "sku" || error.field === "price"
      ? [{ variantId, columnId: error.field }]
      : [],
  );

/**
 * `productVariantStocksUpdate` errors → warehouse cells. `index` names the stock input the API
 * rejected; without it (e.g. a bad warehouse id) every warehouse cell that was sent is marked.
 */
export const getVariantStockErrors = (
  variantId: string,
  stocks: VariantGridUpdate["stocks"],
  errors: Pick<BulkStockErrorFragment, "index">[],
): VariantGridError[] => {
  const errorsFor = errors.flatMap((error) => {
    const stock =
      error.index === null || error.index === undefined ? undefined : stocks[error.index];

    return stock ? [stock] : stocks;
  });

  return [...new Set(errorsFor.map((stock) => stock.warehouse))].map((warehouseId) => ({
    variantId,
    columnId: warehouseColumnId(warehouseId),
  }));
};

/** Whether a cell of a rejected row is tinted red. */
export const hasVariantGridError = (
  errors: VariantGridError[],
  variantId: string,
  columnId: string,
): boolean => errors.some((error) => error.variantId === variantId && error.columnId === columnId);
