import { GridCellKind } from "@glideapps/glide-data-grid";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import type { ProductListRowFragment } from "../../../graphql/types.generated";
import {
  createGetCellContent,
  getNameCellContent,
  getProductAvailability,
  productListStaticColumnsAdapter,
  selectedProductIds,
} from "./datagrid";

const intl = createIntl({ locale: "en" });
const now = Date.parse("2026-11-10T12:00:00Z");

const product = (overrides: Partial<ProductListRowFragment> = {}): ProductListRowFragment => ({
  __typename: "Product",
  id: "p1",
  name: "Prod",
  isPublished: true,
  publishedAt: null,
  minimalVariantPrice: { __typename: "Money", amount: 15000, currency: "MNT" },
  category: { __typename: "Category", id: "c1", name: "Shoes" },
  created: "2026-01-02T10:00:00Z",
  updatedAt: "2026-02-03T10:00:00Z",
  thumbnail: { __typename: "Image", url: "https://example.com/thumb.png" },
  ...overrides,
});

describe("product list datagrid", () => {
  it("has Saleor's columns in the briefed order, with the sort arrow on the sorted one", () => {
    const columns = productListStaticColumnsAdapter(intl, { sort: "date", asc: false });

    expect(columns.map((c) => [c.id, c.title, c.width, c.icon])).toEqual([
      ["name", "Product", 280, undefined],
      ["availability", "Availability", 200, undefined],
      ["price", "Price", 140, undefined],
      ["productCategory", "Category", 180, undefined],
      ["date", "Last updated", 200, "arrowDown"],
      ["created", "Created at", 200, undefined],
    ]);
    expect(productListStaticColumnsAdapter(intl, { sort: "price", asc: true })[2]?.icon).toBe(
      "arrowUp",
    );
    expect(
      productListStaticColumnsAdapter(intl, { sort: "availability", asc: true })[1]?.icon,
    ).toBe("arrowUp");
  });

  it("renders the name as Saleor's thumbnail cell, and the price as formatted text", () => {
    const rows = [product()];
    const columns = productListStaticColumnsAdapter(intl);
    const get = createGetCellContent(rows, columns, { intl, dateNow: now });

    expect(get([0, 0])).toMatchObject({
      kind: GridCellKind.Custom,
      data: {
        kind: "thumbnail-cell",
        name: "Prod",
        image: "https://example.com/thumb.png",
      },
      readonly: true,
      cursor: "pointer",
    });
    expect(get([2, 0])).toMatchObject({
      data: intl.formatNumber(15000, {
        style: "currency",
        currency: "MNT",
        maximumFractionDigits: 0,
      }),
    });
    expect(get([3, 0])).toMatchObject({ data: "Shoes" });
  });

  it("falls back to the empty-image placeholder when the product has no thumbnail", () => {
    expect(getNameCellContent(product({ thumbnail: null }))).toMatchObject({
      kind: GridCellKind.Custom,
      data: { kind: "thumbnail-cell", name: "Prod", image: "" },
    });
    expect(getNameCellContent(product({ name: "Shoes" }))).toMatchObject({
      data: { kind: "thumbnail-cell", name: "Shoes", image: "https://example.com/thumb.png" },
    });
  });

  it("leaves the price and category empty when the product has neither", () => {
    const columns = productListStaticColumnsAdapter(intl);
    const get = createGetCellContent(
      [product({ minimalVariantPrice: null, category: null })],
      columns,
      { intl, dateNow: now },
    );

    expect(get([2, 0])).toMatchObject({ data: "" });
    expect(get([3, 0])).toMatchObject({ data: "" });
  });

  it("shows Published / Hidden, hiding a publication date in the future", () => {
    const columns = productListStaticColumnsAdapter(intl);
    const get = createGetCellContent(
      [
        product({ isPublished: true, publishedAt: null }),
        product({ isPublished: false, publishedAt: null }),
        product({ isPublished: true, publishedAt: "2026-11-10T11:00:00Z" }),
        product({ isPublished: true, publishedAt: "2026-11-10T12:00:05Z" }),
      ],
      columns,
      { intl, dateNow: now },
    );

    expect(get([1, 0])).toMatchObject({ data: "Published" });
    expect(get([1, 1])).toMatchObject({ data: "Hidden" });
    expect(get([1, 2])).toMatchObject({ data: "Published" });
    expect(get([1, 3])).toMatchObject({ data: "Hidden" });
  });

  it("applies Saleor's two-second clock-skew tolerance to the publication date", () => {
    expect(getProductAvailability({ isPublished: true, publishedAt: null }, now)).toBe("published");
    expect(
      getProductAvailability({ isPublished: true, publishedAt: "2026-11-10T12:00:01Z" }, now),
    ).toBe("published");
    expect(
      getProductAvailability({ isPublished: true, publishedAt: "2026-11-10T12:00:05Z" }, now),
    ).toBe("hidden");
    expect(getProductAvailability({ isPublished: false, publishedAt: null }, now)).toBe("hidden");
  });

  it("formats the updated and created dates, and shows nothing outside the rows", () => {
    const columns = productListStaticColumnsAdapter(intl);
    const get = createGetCellContent([product()], columns, { intl, dateNow: now });
    const medium = { dateStyle: "medium" } as const;

    expect(get([4, 0])).toMatchObject({
      data: intl.formatDate(new Date("2026-02-03T10:00:00Z"), medium),
    });
    expect(get([5, 0])).toMatchObject({
      data: intl.formatDate(new Date("2026-01-02T10:00:00Z"), medium),
    });
    expect(get([0, 5])).toMatchObject({ data: "" });
  });

  it("maps the grid's selected row indexes to the products' ids", () => {
    const rows = [product({ id: "a" }), product({ id: "b" }), product({ id: "c" })];

    expect(selectedProductIds(rows, [2, 0])).toEqual(["c", "a"]);
    expect(selectedProductIds(rows, [])).toEqual([]);
  });
});
