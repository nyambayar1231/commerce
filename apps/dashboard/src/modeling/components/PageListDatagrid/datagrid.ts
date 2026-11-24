// Adapted from saleor-dashboard: src/modeling/components/PageListDatagrid/datagrid.ts and
// src/components/ChannelsAvailabilityDropdown/utils.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's columns: title, slug, visibility. Saleor paints the visibility as a status tag and
// reads it from the selected channel's listing; we have one channel, so it comes from the page's
// own `isPublished` / `publishedAt` and is a text cell, as on the collection list.
import type { GridCell, Item } from "@glideapps/glide-data-grid";
import type { IntlShape } from "react-intl";

import { readonlyTextCell } from "../../../components/Datagrid/customCells/cells";
import type { AvailableColumn } from "../../../components/Datagrid/types";
import type { PageListRowFragment } from "../../../graphql/types.generated";
import {
  getColumnSortDirectionIcon,
  type Sort,
} from "../../../utils/columns/getColumnSortDirectionIcon";
import { type PageListUrlSortField, PageListUrlSortField as SortField } from "../../urls";
import { columnsMessages, messages } from "./messages";

export const pageListStaticColumnsAdapter = (
  intl: IntlShape,
  sort?: Sort<PageListUrlSortField>,
): AvailableColumn[] =>
  [
    {
      id: SortField.title,
      title: intl.formatMessage(columnsMessages.title),
      width: 450,
      grow: 1,
    },
    {
      id: SortField.slug,
      title: intl.formatMessage(columnsMessages.slug),
      width: 350,
    },
    {
      id: SortField.visible,
      title: intl.formatMessage(columnsMessages.visible),
      width: 130,
    },
  ].map((column) => ({
    ...column,
    icon: sort ? getColumnSortDirectionIcon(sort, column.id as PageListUrlSortField) : undefined,
  }));

// Saleor's isActive/isScheduled (ChannelsAvailabilityDropdown/utils.ts): a publication date in the
// future keeps the page hidden until it passes, with the same 2-second clock-skew tolerance. The
// collection list repeats this rule too; it stays local per list until a shared helper earns its
// place.
const PUBLICATION_CLOCK_TOLERANCE_MS = 2000;

export type PageAvailability = "published" | "scheduled" | "not-published";

export const getPageAvailability = (
  page: { isPublished: boolean; publishedAt: unknown },
  dateNow: number,
): PageAvailability => {
  if (!page.isPublished) {
    return "not-published";
  }

  // Our codegen has no DateTime scalar mapping, so publishedAt arrives as `unknown`.
  const publishedAt = typeof page.publishedAt === "string" ? Date.parse(page.publishedAt) : null;
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
    rows: PageListRowFragment[],
    columns: AvailableColumn[],
    { intl, dateNow = Date.now() }: CreateGetCellContentOptions,
  ) =>
  ([column, row]: Item): GridCell => {
    const columnId = columns[column]?.id;
    const page = rows[row];

    if (!columnId || !page) {
      return readonlyTextCell("", false);
    }

    switch (columnId) {
      case SortField.title:
        return readonlyTextCell(page.title);
      case SortField.slug:
        return readonlyTextCell(page.slug);
      case SortField.visible:
        return readonlyTextCell(
          intl.formatMessage(
            {
              published: messages.published,
              scheduled: messages.scheduled,
              "not-published": messages.notPublished,
            }[getPageAvailability(page, dateNow)],
          ),
        );
      default:
        return readonlyTextCell("", false);
    }
  };
