// Adapted from saleor-dashboard: src/products/components/ProductListDatagrid/datagrid.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list's columns, in Saleor's default order minus the ones we can't fill: name,
// availability, price, category, last updated and created. Name is Saleor's thumbnail cell (the
// product's image next to its name); availability is Saleor's Published/Hidden wording but a text
// cell, not its dot/status cell (our Datagrid has no status renderer yet). Price and dates are
// formatted with react-intl.
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import {
  readonlyTextCell,
  type ThumbnailCell,
  thumbnailCell,
} from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { ProductListRowFragment } from "../../../graphql/types.generated";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import type { ProductListUrlSortField } from "../../urls";
import { columnsMessages, messages } from "./messages";

export const productListStaticColumnsAdapter = (
  intl: IntlShape,
  sort?: Sort<ProductListUrlSortField>,
): AvailableColumn[] =>
  [
    {
      id: "name",
      title: intl.formatMessage(columnsMessages.name),
      width: 280,
      grow: 1,
    },
    {
      id: "availability",
      title: intl.formatMessage(columnsMessages.availability),
      width: 200,
    },
    {
      id: "price",
      title: intl.formatMessage(columnsMessages.price),
      width: 140,
    },
    {
      id: "productCategory",
      title: intl.formatMessage(columnsMessages.category),
      width: 180,
    },
    {
      id: "date",
      title: intl.formatMessage(columnsMessages.updatedAt),
      width: 200,
    },
    {
      id: "created",
      title: intl.formatMessage(columnsMessages.created),
      width: 200,
    },
  ].map((column) => ({
    ...column,
    icon: sort ? getColumnSortDirectionIcon(sort, column.id as ProductListUrlSortField) : undefined,
  }));

// The category card's single-channel rule (CategoryProducts/availability.ts): a publication date
// in the future stays hidden until it passes, with Saleor's 2-second clock-skew tolerance. It is
// repeated here because that helper lives in a category component; extract it when a third list
// needs it.
const PUBLICATION_CLOCK_TOLERANCE_MS = 2000;

export type ProductAvailability = "published" | "hidden";

export const getProductAvailability = (
  product: { isPublished: boolean; publishedAt: unknown },
  dateNow: number,
): ProductAvailability => {
  if (!product.isPublished) {
    return "hidden";
  }

  // Our codegen has no DateTime scalar mapping, so publishedAt arrives as `unknown`.
  const publishedAt =
    typeof product.publishedAt === "string" ? Date.parse(product.publishedAt) : null;
  const isScheduledForFuture =
    publishedAt !== null && publishedAt > dateNow + PUBLICATION_CLOCK_TOLERANCE_MS;

  return isScheduledForFuture ? "hidden" : "published";
};

/** A price cell's text: the currency with no minor digits (MNT, ADR-0013). Shared with variants. */
export const formatPrice = (
  intl: IntlShape,
  price: { amount: number; currency: string } | null | undefined,
): string =>
  price
    ? intl.formatNumber(price.amount, {
        style: "currency",
        currency: price.currency || "MNT",
        maximumFractionDigits: 0,
      })
    : "";

const formatDate = (intl: IntlShape, value: unknown): string => {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : null;

  return date && !Number.isNaN(date.getTime())
    ? intl.formatDate(date, { dateStyle: "medium" })
    : "";
};

const COMMON_CELL_PROPS = { cursor: "pointer" } as const;

/** The ids of the rows Glide reports as selected, in the grid's row-index order. */
export const selectedProductIds = (
  rows: ProductListRowFragment[],
  selectedRows: number[],
): string[] =>
  selectedRows.flatMap((index) => {
    const product = rows[index];

    return product ? [product.id] : [];
  });

/**
 * Saleor's getNameCellContent: the product's thumbnail next to its name. An empty thumbnail URL
 * renders Saleor's empty-image placeholder in the cell (there is no thumbnail, not a broken image).
 */
export const getNameCellContent = (
  rowData: Pick<ProductListRowFragment, "name" | "thumbnail"> | undefined,
): ThumbnailCell =>
  thumbnailCell(rowData?.name ?? "", rowData?.thumbnail?.url ?? "", COMMON_CELL_PROPS);

interface CreateGetCellContentOptions {
  intl: IntlShape;
  dateNow?: number;
}

export const createGetCellContent =
  (
    rows: ProductListRowFragment[],
    columns: AvailableColumn[],
    { intl, dateNow = Date.now() }: CreateGetCellContentOptions,
  ) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const product = rows[row];

    if (!columnId || !product) {
      return readonlyTextCell("", false);
    }

    switch (columnId) {
      case "name":
        return getNameCellContent(product);
      case "availability":
        return readonlyTextCell(
          intl.formatMessage(
            getProductAvailability(product, dateNow) === "published"
              ? messages.published
              : messages.hidden,
          ),
        );
      case "price":
        return readonlyTextCell(formatPrice(intl, product.minimalVariantPrice));
      case "productCategory":
        return readonlyTextCell(product.category?.name ?? "");
      case "date":
        return readonlyTextCell(formatDate(intl, product.updatedAt));
      case "created":
        return readonlyTextCell(formatDate(intl, product.created));
      default:
        return readonlyTextCell("", false);
    }
  };
