import { closeDb, getDb } from "@commerce/db";
import { afterAll, describe, expect, it } from "vitest";
import { createTestClient } from "../../test/graphql.ts";
import { decodeGlobalId, toGlobalId } from "./globalId.ts";

// The Relay plugin's schema surface, matched to Saleor's: a Node interface, no node/nodes query.
const db = getDb();
const client = createTestClient(db);

afterAll(async () => {
  await closeDb();
});

describe("Relay Node", () => {
  it("is implemented by Category, Checkout, CheckoutLine, Order, OrderEvent, OrderLine, Product, ProductMedia, ProductVariant, ShippingMethod, ShippingMethodType, Stock, TransactionEvent, TransactionItem, User, Warehouse and Group, and Saleor has no node/nodes query", async () => {
    const { body } = await client.gql(`{
      node: __type(name: "Node") { kind possibleTypes { name } }
      query: __type(name: "Query") { fields { name } }
    }`);
    const data = body.data as {
      node: { kind: string; possibleTypes: { name: string }[] };
      query: { fields: { name: string }[] };
    };

    expect(data.node.kind).toBe("INTERFACE");
    expect(data.node.possibleTypes.map((t) => t.name).sort()).toEqual([
      "Category",
      "Checkout",
      "CheckoutLine",
      "Group",
      "Order",
      "OrderEvent",
      "OrderLine",
      "Product",
      "ProductMedia",
      "ProductVariant",
      "ShippingMethod",
      "ShippingMethodType",
      "Stock",
      "TransactionEvent",
      "TransactionItem",
      "User",
      "Warehouse",
    ]);
    expect(data.query.fields.map((f) => f.name)).not.toContain("node");
    expect(data.query.fields.map((f) => f.name)).not.toContain("nodes");
  });

  it("keeps Saleor's global ID format", () => {
    const id = "01a1c09a-5681-7352-8ea2-943fa9c65677";
    expect(toGlobalId("Category", id)).toBe(Buffer.from(`Category:${id}`).toString("base64"));
    expect(decodeGlobalId(toGlobalId("Category", id))).toEqual({ typename: "Category", id });
    expect(() => decodeGlobalId("nope")).toThrow("Couldn't resolve id: nope.");
  });
});
