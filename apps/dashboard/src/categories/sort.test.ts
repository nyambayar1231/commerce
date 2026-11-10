import { describe, expect, it } from "vitest";

import { getSortQueryVariables, getSortUrlParams } from "./sort";

describe("category list sort", () => {
  it("maps the URL sort to the API's sortBy", () => {
    expect(getSortQueryVariables({ sort: "name", asc: true })).toEqual({
      field: "NAME",
      direction: "ASC",
    });
    expect(getSortQueryVariables({ sort: "subcategories", asc: false })).toEqual({
      field: "SUBCATEGORY_COUNT",
      direction: "DESC",
    });
    expect(getSortQueryVariables({ sort: "products", asc: true })).toEqual({
      field: "PRODUCT_COUNT",
      direction: "ASC",
    });
  });

  it("flips the direction on the same column, sorts a new one ascending, and resets the page", () => {
    expect(getSortUrlParams({ sort: "name", asc: true, after: "c", query: "x" }, "name")).toEqual({
      sort: "name",
      asc: false,
      after: undefined,
      before: undefined,
      query: "x",
    });
    expect(getSortUrlParams({ sort: "name", asc: false }, "subcategories")).toMatchObject({
      sort: "subcategories",
      asc: true,
    });
  });
});
