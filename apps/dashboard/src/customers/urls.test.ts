import { describe, expect, it } from "vitest";

import { canBeSorted, getSortQueryVariables, getSortUrlParams } from "./sort";
import { customerListUrl, customerUrl, parseCustomerListUrl } from "./urls";

describe("customer list URL", () => {
  it("round-trips search, sort and the cursor", () => {
    const url = "/customers?sort=orders&asc=false&query=bat&after=abc";
    const params = parseCustomerListUrl(new URLSearchParams(url.split("?")[1]));

    expect(params).toEqual({ sort: "orders", asc: false, query: "bat", after: "abc" });
    expect(customerListUrl(params)).toBe(url);
  });

  it("defaults to Saleor's sort by name, ascending, and ignores invalid values", () => {
    expect(parseCustomerListUrl(new URLSearchParams())).toEqual({ sort: "name", asc: true });
    expect(parseCustomerListUrl(new URLSearchParams("sort=company&asc=maybe"))).toEqual({
      sort: "name",
      asc: true,
    });
    expect(customerListUrl()).toBe("/customers");
  });

  it("links to the customer", () => {
    expect(customerUrl("VXNlcjox")).toBe("/customers/VXNlcjox");
    expect(customerUrl("VXNlcjox==")).toBe("/customers/VXNlcjox%3D%3D");
  });
});

describe("customer list sort", () => {
  it("maps URL fields to Saleor's sort fields (name sorts by last name)", () => {
    expect(getSortQueryVariables({ sort: "name", asc: true })).toEqual({
      field: "LAST_NAME",
      direction: "ASC",
    });
    expect(getSortQueryVariables({ sort: "email", asc: false })).toEqual({
      field: "EMAIL",
      direction: "DESC",
    });
    expect(getSortQueryVariables({ sort: "orders" })?.field).toBe("ORDER_COUNT");
  });

  it("only sorts the columns backed by a sort field", () => {
    expect(["name", "email", "orders", "companyName", undefined].map(canBeSorted)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it("flips the direction on the same column and resets paging", () => {
    expect(getSortUrlParams({ sort: "email", asc: true, after: "c" }, "email")).toEqual({
      sort: "email",
      asc: false,
      after: undefined,
      before: undefined,
    });
    expect(getSortUrlParams({ sort: "email", asc: false, query: "q" }, "orders")).toMatchObject({
      sort: "orders",
      asc: true,
      query: "q",
    });
  });
});
