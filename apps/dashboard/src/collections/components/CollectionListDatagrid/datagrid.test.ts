import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { CollectionListRowFragment } from "../../../graphql/types.generated";
import { collectionListStaticColumnsAdapter, createGetCellContent } from "./datagrid";

const intl = createIntl({ locale: "en" });

const collection = (
  name: string,
  productCount: number,
  isPublished = true,
  publishedAt: string | null = null,
): CollectionListRowFragment => ({
  __typename: "Collection",
  id: name,
  name,
  isPublished,
  publishedAt,
  products: { __typename: "ProductCountableConnection", totalCount: productCount },
});

describe("collection list datagrid", () => {
  it("has Saleor's columns in its order, with the sort arrow on the sorted one", () => {
    const columns = collectionListStaticColumnsAdapter(intl, { sort: "productCount", asc: false });

    expect(columns.map((c) => [c.id, c.title, c.icon])).toEqual([
      ["name", "Collection Name", undefined],
      ["productCount", "No. of Products", "arrowDown"],
      ["availability", "Availability", undefined],
    ]);
    expect(collectionListStaticColumnsAdapter(intl, { sort: "name", asc: true })[0]?.icon).toBe(
      "arrowUp",
    );
    expect(
      collectionListStaticColumnsAdapter(intl, { sort: "availability", asc: true })[2]?.icon,
    ).toBe("arrowUp");
  });

  it("renders read-only text cells for the name and the product count", () => {
    const columns = collectionListStaticColumnsAdapter(intl);
    const getCell = createGetCellContent([collection("Shoes", 7)], columns, { intl });

    expect(getCell([0, 0])).toMatchObject({
      kind: GridCellKind.Text,
      data: "Shoes",
      readonly: true,
      cursor: "pointer",
    });
    expect(getCell([1, 0])).toMatchObject({ data: "7" });
    expect(getCell([0, 5])).toMatchObject({ data: "" });
  });

  it("labels the availability as published, not published, or scheduled to publish", () => {
    const columns = collectionListStaticColumnsAdapter(intl);
    const now = Date.parse("2026-11-19T12:00:00.000Z");
    const rows = [
      collection("Live", 0, true, "2026-11-01T12:00:00.000Z"),
      collection("Never published", 0, false),
      collection("Later", 0, true, "2099-09-09T12:00:00.000Z"),
    ];
    const getCell = createGetCellContent(rows, columns, { intl, dateNow: now });

    expect(getCell([2, 0])).toMatchObject({ data: "Published" });
    expect(getCell([2, 1])).toMatchObject({ data: "Not published" });
    expect(getCell([2, 2])).toMatchObject({ data: "Scheduled to publish" });
  });
});
