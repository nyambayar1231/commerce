// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createPaginationState, usePaginator } from "./usePaginator";

const pageInfo = { startCursor: "s", endCursor: "e", hasNextPage: true, hasPreviousPage: false };

describe("pagination", () => {
  it("asks for the first page, or the page after/before a cursor", () => {
    expect(createPaginationState(20, {})).toEqual({ first: 20 });
    expect(createPaginationState(20, { after: "a" })).toEqual({ after: "a", first: 20 });
    expect(createPaginationState(20, { before: "b" })).toEqual({ before: "b", last: 20 });
  });

  it("links to the next and previous pages, keeping the other params", () => {
    const { result } = renderHook(() =>
      usePaginator({
        pageInfo: { ...pageInfo, hasPreviousPage: true },
        paginationState: { first: 20, after: "x" },
        queryString: { sort: "name", asc: true, query: "" },
      }),
    );

    expect(result.current).toEqual({
      nextHref: "?sort=name&asc=true&after=e",
      prevHref: "?sort=name&asc=true&before=s",
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("has no previous link on the first page", () => {
    const { result } = renderHook(() =>
      usePaginator({ pageInfo, paginationState: { first: 20 }, queryString: {} }),
    );

    expect(result.current.prevHref).toBeUndefined();
    expect(result.current.hasPreviousPage).toBe(false);
  });
});
