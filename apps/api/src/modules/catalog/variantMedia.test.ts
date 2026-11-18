import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStaff,
  createTestClient,
  expectPermissionDenied,
  type GqlResult,
} from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { getStorage } from "../../storage/index.ts";
import { createSession } from "../identity/index.ts";

// Saleor's variantMediaAssign / variantMediaUnassign and ProductVariant.media through the real
// Yoga app and the commerce_test database: assigning a product's images to a variant, the error
// codes, the unique constraint under a duplicate, and the foreign-key cascades.

const db = getDb();
const client = createTestClient(db);

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PRODUCT = ID(500);
const OTHER_PRODUCT = ID(501);
const VARIANT = ID(510);
const OTHER_VARIANT = ID(511);
const MISSING = ID(599);

const mediaGlobalId = (id: string) => toGlobalId("ProductMedia", id);
const variantGlobalId = (id: string) => toGlobalId("ProductVariant", id);
const unknownMedia = mediaGlobalId(MISSING);
const unknownVariant = variantGlobalId(MISSING);

const MEDIA_FIELDS =
  "productVariant { id } media { id alt sortOrder } errors { field code message }";

const ASSIGN = `mutation ($mediaId: ID!, $variantId: ID!) {
  variantMediaAssign(mediaId: $mediaId, variantId: $variantId) { ${MEDIA_FIELDS} }
}`;
const UNASSIGN = `mutation ($mediaId: ID!, $variantId: ID!) {
  variantMediaUnassign(mediaId: $mediaId, variantId: $variantId) { ${MEDIA_FIELDS} }
}`;
const VARIANT_MEDIA = `query ($id: ID!) {
  productVariant(id: $id) { id media { id url alt sortOrder } }
}`;

type ErrorData = { field: string | null; code: string; message: string };
type VariantMediaData = {
  productVariant: { id: string } | null;
  media: { id: string; alt: string; sortOrder: number } | null;
  errors: ErrorData[];
};
type VariantData = {
  id: string;
  media: { id: string; url: string; alt: string; sortOrder: number }[];
};

function payload<T>(result: GqlResult, field: string): T {
  const root = result.body.data as Record<string, T> | null | undefined;
  const value = root?.[field];
  if (!value) throw new Error(`Missing ${field} payload: ${JSON.stringify(result.body)}`);
  return value;
}

/** A media row inserted directly: uploads are covered by mediaMutations.test.ts. */
async function insertMedia(
  id: string,
  { productId = PRODUCT, sortOrder = 0, alt = "" } = {},
): Promise<typeof schema.productMedia.$inferSelect> {
  const [row] = await db
    .insert(schema.productMedia)
    .values({
      id,
      productId,
      imageKey: `products/${productId}/${id}.jpg`,
      contentType: "image/jpeg",
      alt,
      sortOrder,
    })
    .returning();
  if (!row) throw new Error("no media row");
  return row;
}

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  await db.insert(schema.product).values([
    { id: PRODUCT, name: "Hoodie", slug: "hoodie", isPublished: true },
    { id: OTHER_PRODUCT, name: "Cap", slug: "cap", isPublished: true },
  ]);
  await db.insert(schema.productVariant).values([
    { id: VARIANT, productId: PRODUCT, name: "M", priceAmount: 1000, currency: "MNT" },
    { id: OTHER_VARIANT, productId: OTHER_PRODUCT, name: "L", priceAmount: 2000, currency: "MNT" },
  ]);
});

afterAll(async () => {
  await closeDb();
});

describe("variantMediaAssign", () => {
  it("assigns a product media and exposes it on ProductVariant.media", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(600), { alt: "Front" });

    const result = await client.gql(
      ASSIGN,
      { mediaId: mediaGlobalId(media.id), variantId: variantGlobalId(VARIANT) },
      admin.token,
    );

    expect(result.body.errors).toBeUndefined();
    expect(payload<VariantMediaData>(result, "variantMediaAssign")).toEqual({
      productVariant: { id: variantGlobalId(VARIANT) },
      media: { id: mediaGlobalId(media.id), alt: "Front", sortOrder: 0 },
      errors: [],
    });

    const query = await client.gql(VARIANT_MEDIA, { id: variantGlobalId(VARIANT) });
    expect(query.body.errors).toBeUndefined();
    expect((query.body.data as { productVariant: VariantData }).productVariant).toEqual({
      id: variantGlobalId(VARIANT),
      media: [
        {
          id: mediaGlobalId(media.id),
          url: getStorage().publicUrl(media.imageKey),
          alt: "Front",
          sortOrder: 0,
        },
      ],
    });
  });

  it("lists a variant's media in the product's media order", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    // Inserted out of order; the variants links are assigned out of order too.
    const third = await insertMedia(ID(602), { sortOrder: 2 });
    const first = await insertMedia(ID(600), { sortOrder: 0 });
    const second = await insertMedia(ID(601), { sortOrder: 1 });
    const unassigned = await insertMedia(ID(603), { sortOrder: 3 });

    for (const media of [third, first, second]) {
      const assigned = await client.gql(
        ASSIGN,
        { mediaId: mediaGlobalId(media.id), variantId: variantGlobalId(VARIANT) },
        admin.token,
      );
      expect(payload<VariantMediaData>(assigned, "variantMediaAssign").errors).toEqual([]);
    }

    const query = await client.gql(VARIANT_MEDIA, { id: variantGlobalId(VARIANT) });
    expect(query.body.errors).toBeUndefined();
    expect(
      (query.body.data as { productVariant: VariantData }).productVariant.media.map(
        (media) => media.id,
      ),
    ).toEqual([first, second, third].map((media) => mediaGlobalId(media.id)));
    expect(
      (query.body.data as { productVariant: VariantData }).productVariant.media.map(
        (media) => media.id,
      ),
    ).not.toContain(mediaGlobalId(unassigned.id));
  });

  it("keeps a single row when the same media is assigned twice", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(604));
    const variables = { mediaId: mediaGlobalId(media.id), variantId: variantGlobalId(VARIANT) };

    const first = await client.gql(ASSIGN, variables, admin.token);
    expect(payload<VariantMediaData>(first, "variantMediaAssign").errors).toEqual([]);

    const second = await client.gql(ASSIGN, variables, admin.token);
    expect(payload<VariantMediaData>(second, "variantMediaAssign")).toEqual({
      productVariant: null,
      media: null,
      errors: [
        {
          field: "mediaId",
          code: "MEDIA_ALREADY_ASSIGNED",
          message: "This media is already assigned",
        },
      ],
    });
    expect(await db.select().from(schema.variantMedia)).toHaveLength(1);
  });

  it("reports an unknown media or variant as NOT_FOUND on its argument", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    await insertMedia(ID(605));

    const unknownMediaResult = await client.gql(
      ASSIGN,
      { mediaId: unknownMedia, variantId: variantGlobalId(VARIANT) },
      admin.token,
    );
    expect(payload<VariantMediaData>(unknownMediaResult, "variantMediaAssign")).toEqual({
      productVariant: null,
      media: null,
      errors: [
        {
          field: "mediaId",
          code: "NOT_FOUND",
          message: `Couldn't resolve to a node: ${unknownMedia}`,
        },
      ],
    });

    const unknownVariantResult = await client.gql(
      ASSIGN,
      { mediaId: mediaGlobalId(ID(605)), variantId: unknownVariant },
      admin.token,
    );
    expect(payload<VariantMediaData>(unknownVariantResult, "variantMediaAssign")).toEqual({
      productVariant: null,
      media: null,
      errors: [
        {
          field: "variantId",
          code: "NOT_FOUND",
          message: `Couldn't resolve to a node: ${unknownVariant}`,
        },
      ],
    });
  });

  it("rejects media of another product", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const foreign = await insertMedia(ID(606), { productId: OTHER_PRODUCT });

    const result = await client.gql(
      ASSIGN,
      { mediaId: mediaGlobalId(foreign.id), variantId: variantGlobalId(VARIANT) },
      admin.token,
    );

    expect(payload<VariantMediaData>(result, "variantMediaAssign")).toEqual({
      productVariant: null,
      media: null,
      errors: [
        {
          field: "mediaId",
          code: "NOT_PRODUCTS_IMAGE",
          message: "This media doesn't belong to that product.",
        },
      ],
    });
    expect(await db.select().from(schema.variantMedia)).toEqual([]);
  });
});

describe("variantMediaUnassign", () => {
  it("unassigns a media", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(610));
    const variables = { mediaId: mediaGlobalId(media.id), variantId: variantGlobalId(VARIANT) };

    await client.gql(ASSIGN, variables, admin.token);
    const result = await client.gql(UNASSIGN, variables, admin.token);

    expect(result.body.errors).toBeUndefined();
    expect(payload<VariantMediaData>(result, "variantMediaUnassign")).toEqual({
      productVariant: { id: variantGlobalId(VARIANT) },
      media: { id: mediaGlobalId(media.id), alt: "", sortOrder: 0 },
      errors: [],
    });
    expect(await db.select().from(schema.variantMedia)).toEqual([]);

    const query = await client.gql(VARIANT_MEDIA, { id: variantGlobalId(VARIANT) });
    expect((query.body.data as { productVariant: VariantData }).productVariant.media).toEqual([]);
  });

  it("reports media that is not assigned as NOT_PRODUCTS_IMAGE", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(611));

    const result = await client.gql(
      UNASSIGN,
      { mediaId: mediaGlobalId(media.id), variantId: variantGlobalId(VARIANT) },
      admin.token,
    );

    expect(payload<VariantMediaData>(result, "variantMediaUnassign")).toEqual({
      productVariant: null,
      media: null,
      errors: [
        {
          field: "mediaId",
          code: "NOT_PRODUCTS_IMAGE",
          message: "Media is not assigned to this variant.",
        },
      ],
    });
  });

  it("reports an unknown media or variant as NOT_FOUND on its argument", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(612));

    const unknownMediaResult = await client.gql(
      UNASSIGN,
      { mediaId: unknownMedia, variantId: variantGlobalId(VARIANT) },
      admin.token,
    );
    expect(payload<VariantMediaData>(unknownMediaResult, "variantMediaUnassign").errors).toEqual([
      {
        field: "mediaId",
        code: "NOT_FOUND",
        message: `Couldn't resolve to a node: ${unknownMedia}`,
      },
    ]);

    const unknownVariantResult = await client.gql(
      UNASSIGN,
      { mediaId: mediaGlobalId(media.id), variantId: unknownVariant },
      admin.token,
    );
    expect(payload<VariantMediaData>(unknownVariantResult, "variantMediaUnassign").errors).toEqual([
      {
        field: "variantId",
        code: "NOT_FOUND",
        message: `Couldn't resolve to a node: ${unknownVariant}`,
      },
    ]);
  });
});

describe("foreign-key cascades", () => {
  it("removes the links when the media row is deleted", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const kept = await insertMedia(ID(620), { sortOrder: 0 });
    const deleted = await insertMedia(ID(621), { sortOrder: 1 });
    for (const media of [kept, deleted]) {
      await client.gql(
        ASSIGN,
        { mediaId: mediaGlobalId(media.id), variantId: variantGlobalId(VARIANT) },
        admin.token,
      );
    }

    await db.delete(schema.productMedia).where(eq(schema.productMedia.id, deleted.id));

    const rows = await db.select().from(schema.variantMedia);
    expect(rows.map((row) => row.mediaId)).toEqual([kept.id]);
  });

  it("removes the links when the variant is deleted", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(622));
    await client.gql(
      ASSIGN,
      { mediaId: mediaGlobalId(media.id), variantId: variantGlobalId(VARIANT) },
      admin.token,
    );

    await db.delete(schema.productVariant).where(eq(schema.productVariant.id, VARIANT));

    expect(await db.select().from(schema.variantMedia)).toEqual([]);
    expect(await db.select().from(schema.productMedia)).toHaveLength(1);
  });
});

describe.each([
  {
    name: "variantMediaAssign",
    call: (token?: string) =>
      client.gql(
        ASSIGN,
        { mediaId: mediaGlobalId(MISSING), variantId: variantGlobalId(VARIANT) },
        token,
      ),
  },
  {
    name: "variantMediaUnassign",
    call: (token?: string) =>
      client.gql(
        UNASSIGN,
        { mediaId: mediaGlobalId(MISSING), variantId: variantGlobalId(VARIANT) },
        token,
      ),
  },
])("$name requires MANAGE_PRODUCTS", ({ call }) => {
  it("denies anonymous requests", async () => {
    expectPermissionDenied(await call(), ["MANAGE_PRODUCTS"]);
  });

  it("denies a customer", async () => {
    const [customer] = await db
      .insert(schema.user)
      .values({ email: `${crypto.randomUUID()}@example.com` })
      .returning({ id: schema.user.id });
    if (!customer) throw new Error("no customer");
    const { token } = await createSession(db, customer.id);
    expectPermissionDenied(await call(token), ["MANAGE_PRODUCTS"]);
  });

  it("denies staff without MANAGE_PRODUCTS", async () => {
    const { token } = await createStaff(db, ["MANAGE_ORDERS"]);
    expectPermissionDenied(await call(token), ["MANAGE_PRODUCTS"]);
  });
});
