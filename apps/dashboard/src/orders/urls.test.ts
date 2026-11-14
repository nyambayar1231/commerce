import { describe, expect, it } from "vitest";

import {
  getDraftSortQueryVariables,
  getDraftSortUrlParams,
  getSortQueryVariables,
  getSortUrlParams,
} from "./sort";
import {
  orderDraftListUrl,
  orderDraftUrl,
  orderFulfillUrl,
  orderListUrl,
  orderUrl,
  parseOrderDraftListUrl,
  parseOrderListUrl,
  parseOrderUrl,
} from "./urls";

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

  it("links to the order, its dialogs and its Fulfill page", () => {
    expect(orderUrl("T3JkZXI6MQ==")).toBe("/orders/T3JkZXI6MQ%3D%3D");
    expect(orderUrl("o1", { action: "refund", id: "t1" })).toBe("/orders/o1?action=refund&id=t1");
    expect(orderFulfillUrl("T3JkZXI6MQ==")).toBe("/orders/T3JkZXI6MQ%3D%3D/fulfill");
    expect(parseOrderUrl(new URLSearchParams("action=mark-paid"))).toEqual({
      action: "mark-paid",
      id: undefined,
    });
    expect(parseOrderUrl(new URLSearchParams("action=delete")).action).toBeUndefined();
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

describe("draft order URLs", () => {
  it("round-trips search, sort and the cursor, and links to a draft", () => {
    const url = orderDraftListUrl({ query: "ada", sort: "customer", asc: true, after: "c1" });

    expect(url).toBe("/orders/drafts?query=ada&sort=customer&asc=true&after=c1");
    expect(parseOrderDraftListUrl(new URLSearchParams(url.split("?")[1]))).toEqual({
      query: "ada",
      sort: "customer",
      asc: true,
      after: "c1",
    });
    expect(orderDraftListUrl()).toBe("/orders/drafts");
    expect(parseOrderDraftListUrl(new URLSearchParams("sort=payment&asc=1"))).toEqual({});
    expect(orderDraftUrl("T3JkZXI6MQ==")).toBe("/orders/drafts/T3JkZXI6MQ%3D%3D");
  });

  it("maps sort fields to Saleor's, total not sortable", () => {
    expect(getDraftSortQueryVariables({ sort: "date", asc: false })).toEqual({
      field: "CREATED_AT",
      direction: "DESC",
    });
    expect(getDraftSortQueryVariables({ sort: "total" })).toBeUndefined();
    expect(getDraftSortUrlParams({ sort: "number", asc: false, after: "x" }, "number")).toEqual({
      sort: "number",
      asc: true,
      after: undefined,
      before: undefined,
    });
  });
});
