import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";

// GraphQL contract for Saleor's productBulkDelete, through the real app and the real (test) DB.
const db = getDb();
const client = createTestClient(db);

const BULK_DELETE = `mutation ($ids: [ID!]!) {
  productBulkDelete(ids: $ids) { count errors { field code message } }
}`;

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BOOTS = ID(600);
const SHOES = ID(601);
const HATS = ID(602);
const BOOTS_MEDIA = ID(610);

const productId = (id: string) => toGlobalId("Product", id);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  await db.insert(schema.product).values([
    { id: BOOTS, name: "Boots", slug: "boots" },
    { id: SHOES, name: "Shoes", slug: "shoes" },
    { id: HATS, name: "Hats", slug: "hats" },
  ]);
  await db.insert(schema.productVariant).values([
    { productId: BOOTS, name: "Size 39", priceAmount: 1000, currency: "MNT" },
    { productId: SHOES, name: "Size 40", priceAmount: 2000, currency: "MNT" },
  ]);
  await db.insert(schema.productMedia).values({
    id: BOOTS_MEDIA,
    productId: BOOTS,
    imageKey: `products/${BOOTS}/${BOOTS_MEDIA}.jpg`,
    contentType: "image/jpeg",
    alt: "",
    sortOrder: 0,
  });
  await db.insert(schema.productMediaThumbnail).values({
    mediaId: BOOTS_MEDIA,
    size: 128,
    format: "ORIGINAL",
    imageKey: `thumbnails/${BOOTS_MEDIA}/128.jpg`,
  });
});

afterAll(async () => {
  await closeDb();
});

const remaining = async () =>
  (await db.select({ name: schema.product.name }).from(schema.product))
    .map((row) => row.name)
    .sort();

describe("productBulkDelete", () => {
  it("requires MANAGE_PRODUCTS", async () => {
    expectPermissionDenied(await client.gql(BULK_DELETE, { ids: [productId(HATS)] }), [
      "MANAGE_PRODUCTS",
    ]);
    const { token } = await createStaff(db, ["MANAGE_ORDERS"]);
    expectPermissionDenied(await client.gql(BULK_DELETE, { ids: [productId(HATS)] }, token), [
      "MANAGE_PRODUCTS",
    ]);
    expect(await remaining()).toEqual(["Boots", "Hats", "Shoes"]);
  });

  it("deletes the given products with their variants and media, and returns the count", async () => {
    const { token } = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await client.gql(
      BULK_DELETE,
      { ids: [productId(BOOTS), productId(SHOES)] },
      token,
    );

    expect(result.body.errors).toBeUndefined();
    expect(result.body.data).toEqual({ productBulkDelete: { count: 2, errors: [] } });
    expect(await remaining()).toEqual(["Hats"]);
    expect(
      await db.select({ productId: schema.productVariant.productId }).from(schema.productVariant),
    ).toEqual([]);
    expect(await db.select().from(schema.productMedia)).toEqual([]);
    expect(await db.select().from(schema.productMediaThumbnail)).toEqual([]);
  });

  it("counts duplicate ids once", async () => {
    const { token } = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await client.gql(
      BULK_DELETE,
      { ids: [productId(HATS), productId(HATS)] },
      token,
    );

    expect(result.body.data).toEqual({ productBulkDelete: { count: 1, errors: [] } });
    expect(await remaining()).toEqual(["Boots", "Shoes"]);
  });

  it("refuses unknown or malformed ids without deleting anything", async () => {
    const { token } = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const unknown = productId(crypto.randomUUID());
    const notFound = await client.gql(BULK_DELETE, { ids: [productId(HATS), unknown] }, token);

    expect(notFound.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );

    const wrongType = await client.gql(
      BULK_DELETE,
      { ids: [toGlobalId("User", crypto.randomUUID())] },
      token,
    );
    expect(wrongType.body.errors?.[0]?.message).toMatch(
      /^Invalid ID: .* Expected: Product, received: User\.$/,
    );

    expect(await remaining()).toEqual(["Boots", "Hats", "Shoes"]);
  });
});
