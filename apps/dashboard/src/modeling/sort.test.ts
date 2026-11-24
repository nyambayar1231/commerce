import { describe, expect, it } from "vitest";

import { getSortQueryVariables, getSortUrlParams } from "./sort";

describe("page list sort", () => {
  it("maps the URL sort to the API's sortBy", () => {
    expect(getSortQueryVariables({ sort: "title", asc: true })).toEqual({
      field: "TITLE",
      direction: "ASC",
    });
    expect(getSortQueryVariables({ sort: "slug", asc: false })).toEqual({
      field: "SLUG",
      direction: "DESC",
    });
    expect(getSortQueryVariables({ sort: "visible", asc: true })).toEqual({
      field: "VISIBILITY",
      direction: "ASC",
    });
    expect(getSortQueryVariables({})).toBeUndefined();
  });

  it("flips the direction on the same column, sorts a new one ascending, and resets the page", () => {
    expect(getSortUrlParams({ sort: "title", asc: true, after: "c", query: "x" }, "title")).toEqual(
      {
        sort: "title",
        asc: false,
        after: undefined,
        before: undefined,
        query: "x",
      },
    );
    expect(getSortUrlParams({ sort: "title", asc: false }, "visible")).toMatchObject({
      sort: "visible",
      asc: true,
    });
  });
});
