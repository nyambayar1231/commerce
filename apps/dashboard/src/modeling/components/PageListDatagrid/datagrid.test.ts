import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { PageListRowFragment } from "../../../graphql/types.generated";
import { createGetCellContent, pageListStaticColumnsAdapter } from "./datagrid";

const intl = createIntl({ locale: "en" });

const page = (
  title: string,
  slug: string,
  isPublished = true,
  publishedAt: string | null = null,
): PageListRowFragment => ({
  __typename: "Page",
  id: slug,
  title,
  slug,
  isPublished,
  publishedAt,
});

describe("page list datagrid", () => {
  it("has Saleor's columns in its order, with the sort arrow on the sorted one", () => {
    const columns = pageListStaticColumnsAdapter(intl, { sort: "slug", asc: false });

    expect(columns.map((c) => [c.id, c.title, c.icon])).toEqual([
      ["title", "Title", undefined],
      ["slug", "Slug", "arrowDown"],
      ["visible", "Visibility", undefined],
    ]);
    expect(pageListStaticColumnsAdapter(intl, { sort: "title", asc: true })[0]?.icon).toBe(
      "arrowUp",
    );
    expect(pageListStaticColumnsAdapter(intl, { sort: "visible", asc: true })[2]?.icon).toBe(
      "arrowUp",
    );
  });

  it("renders read-only text cells for the title and the slug", () => {
    const columns = pageListStaticColumnsAdapter(intl);
    const getCell = createGetCellContent([page("About us", "about-us")], columns, { intl });

    expect(getCell([0, 0])).toMatchObject({
      kind: GridCellKind.Text,
      data: "About us",
      readonly: true,
      cursor: "pointer",
    });
    expect(getCell([1, 0])).toMatchObject({ data: "about-us" });
    expect(getCell([0, 5])).toMatchObject({ data: "" });
  });

  it("labels the visibility as published, not published, or scheduled to publish", () => {
    const columns = pageListStaticColumnsAdapter(intl);
    const now = Date.parse("2026-11-24T12:00:00.000Z");
    const rows = [
      page("Live", "live", true, "2026-11-01T12:00:00.000Z"),
      page("Never published", "never", false),
      page("Later", "later", true, "2099-09-09T12:00:00.000Z"),
    ];
    const getCell = createGetCellContent(rows, columns, { intl, dateNow: now });

    expect(getCell([2, 0])).toMatchObject({ data: "Published" });
    expect(getCell([2, 1])).toMatchObject({ data: "Not published" });
    expect(getCell([2, 2])).toMatchObject({ data: "Scheduled to publish" });
  });
});
