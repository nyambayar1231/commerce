// Adapted from saleor-dashboard: src/collections/components/CollectionListDatagrid/datagrid.ts and
// src/components/ChannelsAvailabilityDropdown/utils.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's columns: collection name, number of products, availability. Saleor reads the
// availability from the selected channel's listing; we have one channel, so it comes from the
// collection's own `isPublished` / `publishedAt`, labelled with Saleor's channel status wording
// (published, scheduled to publish, otherwise not published). The labels are text cells, as on the
// product list (our Datagrid has no status/dot renderer yet).
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import { readonlyTextCell } from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { CollectionListRowFragment } from "../../../graphql/types.generated";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import type { CollectionListUrlSortField } from "../../urls";
import { columnsMessages, messages } from "./messages";

export const collectionListStaticColumnsAdapter = (
  intl: IntlShape,
  sort?: Sort<CollectionListUrlSortField>,
): AvailableColumn[] =>
  [
    {
      id: "name",
      title: intl.formatMessage(columnsMessages.name),
      width: 350,
      grow: 1,
    },
    {
      id: "productCount",
      title: intl.formatMessage(columnsMessages.noOfProducts),
      width: 200,
    },
    {
      id: "availability",
      title: intl.formatMessage(columnsMessages.availability),
      width: 200,
    },
  ].map((column) => ({
    ...column,
    icon: sort
      ? getColumnSortDirectionIcon(sort, column.id as CollectionListUrlSortField)
      : undefined,
  }));

// Saleor's isActive/isScheduled (ChannelsAvailabilityDropdown/utils.ts): a publication date in the
// future keeps the collection hidden until it passes, with the same 2-second clock-skew tolerance.
// The product list repeats this rule too (products/components/ProductListDatagrid/datagrid.ts); it
// stays local per list until a shared helper earns its place.
const PUBLICATION_CLOCK_TOLERANCE_MS = 2000;

export type CollectionAvailability = "published" | "scheduled" | "not-published";

export const getCollectionAvailability = (
  collection: { isPublished: boolean; publishedAt: unknown },
  dateNow: number,
): CollectionAvailability => {
  if (!collection.isPublished) {
    return "not-published";
  }

  // Our codegen has no DateTime scalar mapping, so publishedAt arrives as `unknown`.
  const publishedAt =
    typeof collection.publishedAt === "string" ? Date.parse(collection.publishedAt) : null;
  const isScheduledForFuture =
    publishedAt !== null && publishedAt > dateNow + PUBLICATION_CLOCK_TOLERANCE_MS;

  return isScheduledForFuture ? "scheduled" : "published";
};

interface CreateGetCellContentOptions {
  intl: IntlShape;
  dateNow?: number;
}

export const createGetCellContent =
  (
    rows: CollectionListRowFragment[],
    columns: AvailableColumn[],
    { intl, dateNow = Date.now() }: CreateGetCellContentOptions,
  ) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const collection = rows[row];

    if (!columnId || !collection) {
      return readonlyTextCell("", false);
    }

    switch (columnId) {
      case "name":
        return readonlyTextCell(collection.name);
      case "productCount":
        return readonlyTextCell(collection.products?.totalCount?.toString() ?? "");
      case "availability":
        return readonlyTextCell(
          intl.formatMessage(
            {
              published: messages.published,
              scheduled: messages.scheduled,
              "not-published": messages.notPublished,
            }[getCollectionAvailability(collection, dateNow)],
          ),
        );
      default:
        return readonlyTextCell("", false);
    }
  };
