import { describe, expect, it } from "vitest";

import { getSortQueryVariables, getSortUrlParams } from "./sort";
import { orderListUrl, orderUrl, parseOrderListUrl } from "./urls";

describe("order list URL", () => {
  it("round-trips filters, search, sort and the cursor", () => {
    const url =
      "/orders?0%5Bs2.status%5D%5B0%5D=FULFILLED&query=1001&sort=date&asc=false&after=abc";
    const params = parseOrderListUrl(new URLSearchParams(url.split("?")[1]));

    expect(params).toMatchObject({ query: "1001", sort: "date", asc: false, after: "abc" });
    expect(params.filters).toHaveLength(1);
    expect(orderListUrl(params)).toBe(url);
  });

  it("ignores invalid values", () => {
    expect(parseOrderListUrl(new URLSearchParams("sort=total&asc=maybe"))).toEqual({});
  });

  it("links to the order", () => {
    expect(orderUrl("T3JkZXI6MQ==")).toBe("/orders/T3JkZXI6MQ%3D%3D");
  });
});

describe("order list sort", () => {
  it("maps URL fields to Saleor's sort fields", () => {
    expect(getSortQueryVariables({ sort: "number", asc: false })).toEqual({
      field: "NUMBER",
      direction: "DESC",
    });
    expect(getSortQueryVariables({ sort: "date", asc: true })?.field).toBe("CREATED_AT");
    expect(getSortQueryVariables({ sort: "status" })?.field).toBe("FULFILLMENT_STATUS");
    expect(getSortQueryVariables({ sort: "payment" })?.field).toBe("PAYMENT");
    expect(getSortQueryVariables({ sort: "customer" })?.field).toBe("CUSTOMER");
    expect(getSortQueryVariables({})).toBeUndefined();
  });

  it("flips the direction on the same column and resets paging", () => {
    expect(getSortUrlParams({ sort: "number", asc: false, after: "x" }, "number")).toEqual({
      sort: "number",
      asc: true,
      after: undefined,
      before: undefined,
    });
    expect(getSortUrlParams({ sort: "number", asc: false }, "date").asc).toBe(true);
  });
});
