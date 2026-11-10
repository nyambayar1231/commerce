import { describe, expect, it } from "vitest";

import { getSortQueryVariables, getSortUrlParams } from "./sort";

describe("product list sort", () => {
  it("maps the URL sort to the API's sortBy", () => {
    expect(getSortQueryVariables({ sort: "name", asc: true })).toEqual({
      field: "NAME",
      direction: "ASC",
    });
    expect(getSortQueryVariables({ sort: "availability", asc: false })).toEqual({
      field: "PUBLISHED",
      direction: "DESC",
    });
    expect(getSortQueryVariables({ sort: "price", asc: true })).toEqual({
      field: "PRICE",
      direction: "ASC",
    });
    expect(getSortQueryVariables({ sort: "date", asc: false })).toEqual({
      field: "LAST_MODIFIED_AT",
      direction: "DESC",
    });
    expect(getSortQueryVariables({ sort: "created", asc: true })).toEqual({
      field: "CREATED_AT",
      direction: "ASC",
    });
  });

  it("has no sort variables without a sort", () => {
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
    expect(getSortUrlParams({ sort: "name", asc: false }, "price")).toMatchObject({
      sort: "price",
      asc: true,
    });
  });
});
