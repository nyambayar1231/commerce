import { describe, expect, it } from "vitest";

import { getSortQueryVariables, getSortUrlParams } from "./sort";

describe("collection list sort", () => {
  it("maps the URL sort to the API's sortBy", () => {
    expect(getSortQueryVariables({ sort: "name", asc: true })).toEqual({
      field: "NAME",
      direction: "ASC",
    });
    expect(getSortQueryVariables({ sort: "productCount", asc: false })).toEqual({
      field: "PRODUCT_COUNT",
      direction: "DESC",
    });
    expect(getSortQueryVariables({ sort: "availability", asc: true })).toEqual({
      field: "AVAILABILITY",
      direction: "ASC",
    });
    expect(getSortQueryVariables({})).toBeUndefined();
  });

  it("flips the direction on the same column, sorts a new one ascending, and resets the page", () => {
    expect(getSortUrlParams({ sort: "name", asc: true, after: "c", query: "x" }, "name")).toEqual({
      sort: "name",
      asc: false,
      after: undefined,
      before: undefined,
      query: "x",
    });
    expect(getSortUrlParams({ sort: "name", asc: false }, "availability")).toMatchObject({
      sort: "availability",
      asc: true,
    });
  });
});
