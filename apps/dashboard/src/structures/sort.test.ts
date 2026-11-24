import { describe, expect, it } from "vitest";

import { getSortQueryVariables, getSortUrlParams } from "./sort";

describe("menu sort", () => {
  it("maps the URL sort fields to the API's", () => {
    expect(getSortQueryVariables({ sort: "name", asc: true })).toEqual({
      field: "NAME",
      direction: "ASC",
    });
    expect(getSortQueryVariables({ sort: "items", asc: false })).toEqual({
      field: "ITEMS_COUNT",
      direction: "DESC",
    });
  });

  it("sends no sort when the URL names none", () => {
    expect(getSortQueryVariables({})).toBeUndefined();
  });

  it("flips the direction on the same column and starts another one ascending", () => {
    expect(getSortUrlParams({ sort: "name", asc: true, after: "a" }, "name")).toMatchObject({
      sort: "name",
      asc: false,
      after: undefined,
      before: undefined,
    });
    expect(getSortUrlParams({ sort: "name", asc: false }, "items")).toMatchObject({
      sort: "items",
      asc: true,
    });
  });
});
