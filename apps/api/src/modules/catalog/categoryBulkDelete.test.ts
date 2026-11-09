import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// GraphQL contract for Saleor's categoryBulkDelete, through the real app and the real (test) DB.
const db = getDb();
const client = createTestClient(db);

const BULK_DELETE = `mutation ($ids: [ID!]!) {
  categoryBulkDelete(ids: $ids) { count errors { field code message } }
}`;

const ids = new Map<string, string>();

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category CASCADE');
  ids.clear();
  const add = async (name: string, parent?: string) => {
    const [row] = await db
      .insert(schema.category)
      .values({ name, slug: name.toLowerCase(), parentId: parent ? ids.get(parent) : undefined })
      .returning({ id: schema.category.id });
    if (!row) throw new Error("no row");
    ids.set(name, row.id);
  };
  await add("Shoes");
  await add("Boots", "Shoes");
  await add("Hats");
  await add("Bags");
});

afterAll(async () => {
  await closeDb();
});

const globalIds = (...names: string[]) =>
  names.map((n) => toGlobalId("Category", ids.get(n) ?? ""));
const remaining = async () =>
  (await db.select({ name: schema.category.name }).from(schema.category))
    .map((row) => row.name)
    .sort();

describe("categoryBulkDelete", () => {
  it("requires MANAGE_PRODUCTS", async () => {
    expectPermissionDenied(await client.gql(BULK_DELETE, { ids: globalIds("Hats") }), [
      "MANAGE_PRODUCTS",
    ]);
    const { token } = await createStaff(db, ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(BULK_DELETE, { ids: globalIds("Hats") }, token), [
      "MANAGE_PRODUCTS",
    ]);
    expect(await remaining()).toEqual(["Bags", "Boots", "Hats", "Shoes"]);
  });

  it("deletes the given categories and their subtrees, counting the given ones", async () => {
    const { token } = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const result = await client.gql(BULK_DELETE, { ids: globalIds("Shoes", "Hats") }, token);

    expect(result.body.data).toEqual({ categoryBulkDelete: { count: 2, errors: [] } });
    expect(await remaining()).toEqual(["Bags"]);
  });

  it("refuses unknown or malformed IDs without deleting anything", async () => {
    const { token } = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const unknown = toGlobalId("Category", crypto.randomUUID());
    const notFound = await client.gql(BULK_DELETE, { ids: [...globalIds("Hats"), unknown] }, token);

    expect(notFound.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
    const wrongType = await client.gql(
      BULK_DELETE,
      { ids: [toGlobalId("User", crypto.randomUUID())] },
      token,
    );
    expect(wrongType.body.errors?.[0]?.message).toMatch(
      /^Invalid ID: .* Expected: Category, received: User\.$/,
    );
    expect(await remaining()).toEqual(["Bags", "Boots", "Hats", "Shoes"]);
  });
});
