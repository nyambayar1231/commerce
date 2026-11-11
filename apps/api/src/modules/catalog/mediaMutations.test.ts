import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStaff,
  createTestClient,
  expectPermissionDenied,
  type GqlResult,
} from "../../../test/graphql.ts";
import { createApp } from "../../app.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { readStorageConfig } from "../../storage/index.ts";
import { createSession } from "../identity/index.ts";
import { MAX_IMAGE_BYTES } from "./index.ts";

// Saleor's product media mutations through the real Yoga app, the commerce_test database and the
// test media bucket: multipart uploads (graphql-multipart-request-spec), alt updates, deletes and
// reordering, with the objects checked in S3.

const db = getDb();
const app = createApp(db, { allowedOrigins: ["http://localhost:5173"] });
const client = createTestClient(db);
const storageConfig = readStorageConfig(process.env);

// The bucket is listed directly: the storage interface has no list (ADR-0014), and the "nothing
// was written" assertions need to see objects no row points at.
const s3 = new S3Client({
  region: storageConfig.region,
  ...(storageConfig.endpoint !== undefined && {
    endpoint: storageConfig.endpoint,
    forcePathStyle: true,
  }),
  ...(storageConfig.accessKeyId !== undefined &&
    storageConfig.secretAccessKey !== undefined && {
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
    }),
});

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PRODUCT = ID(400);
const OTHER_PRODUCT = ID(401);
const MISSING = ID(499);

const productId = toGlobalId("Product", PRODUCT);
const mediaId = (id: string) => toGlobalId("ProductMedia", id);
const unknownMedia = toGlobalId("ProductMedia", MISSING);

const canvas = () => sharp({ create: { width: 8, height: 8, channels: 3, background: "#ff0000" } });

const images = {
  jpeg: () => canvas().jpeg().toBuffer(),
  png: () => canvas().png().toBuffer(),
  gif: () => canvas().gif().toBuffer(),
  webp: () => canvas().webp().toBuffer(),
  tiff: () => canvas().tiff().toBuffer(),
};

const imageFile = async (format: keyof typeof images, name = `image.${format}`) =>
  new File([await images[format]()], name, { type: `image/${format}` });

const MEDIA_FIELDS = "media { id alt sortOrder type url productId }";
const ERRORS = "errors { field code message }";

const CREATE = `mutation ($input: ProductMediaCreateInput!) {
  productMediaCreate(input: $input) { product { id } ${MEDIA_FIELDS} ${ERRORS} }
}`;
const UPDATE = `mutation ($id: ID!, $input: ProductMediaUpdateInput!) {
  productMediaUpdate(id: $id, input: $input) { ${MEDIA_FIELDS} ${ERRORS} }
}`;
const DELETE = `mutation ($id: ID!) {
  productMediaDelete(id: $id) { ${MEDIA_FIELDS} ${ERRORS} }
}`;
const REORDER = `mutation ($productId: ID!, $mediaIds: [ID!]!) {
  productMediaReorder(productId: $productId, mediaIds: $mediaIds) {
    product { id }
    media { id sortOrder }
    ${ERRORS}
  }
}`;

type ErrorData = { field: string | null; code: string; message: string };
type MediaData = {
  id: string;
  alt: string;
  sortOrder: number;
  type: string;
  url: string;
  productId: string;
};
type MediaPayloadData = { media: MediaData | null; errors: ErrorData[] };
type ReorderPayloadData = {
  media: { id: string; sortOrder: number }[];
  errors: ErrorData[];
};

function payload<T>(result: GqlResult, field: string): T {
  const root = result.body.data as Record<string, T> | null | undefined;
  const value = root?.[field];
  if (!value) throw new Error(`Missing ${field} payload: ${JSON.stringify(result.body)}`);
  return value;
}

type MultipartArgs = {
  query: string;
  variables: Record<string, unknown>;
  file?: File;
  /** The variable path the file replaces, e.g. "input.image". */
  path?: string;
  token?: string;
  csrf?: boolean;
};

/** A graphql-multipart-request-spec POST: `operations`, `map`, then one part per file. */
async function postMultipart({
  query,
  variables,
  file,
  path = "input.image",
  token,
  csrf = true,
}: MultipartArgs): Promise<GqlResult> {
  const form = new FormData();
  form.set("operations", JSON.stringify({ query, variables }));
  if (file) {
    form.set("map", JSON.stringify({ "0": [`variables.${path}`] }));
    form.set("0", file);
  }
  const response = await app.fetch("http://test/graphql", {
    method: "POST",
    headers: {
      ...(csrf ? { "x-graphql-yoga-csrf": "1" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  return { response, body: (await response.json()) as GqlResult["body"] };
}

async function objectKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  let truncated = true;
  // SeaweedFS sets a continuation token even on the last page; `IsTruncated` is the stop signal.
  while (truncated) {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: storageConfig.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
    token = page.NextContinuationToken;
    truncated = page.IsTruncated === true;
  }
  return keys;
}

async function deleteObject(key: string): Promise<void> {
  await s3
    .send(new DeleteObjectCommand({ Bucket: storageConfig.bucket, Key: key }))
    .catch(() => undefined);
}

/** Puts an object through the same client the assertions list with (the app has its own storage). */
async function putObject(key: string, body: Uint8Array): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
    }),
  );
}

beforeEach(async () => {
  // The rows of the previous test name its objects; remove both before the truncate.
  const keys = [
    ...(await db.select({ key: schema.productMedia.imageKey }).from(schema.productMedia)),
    ...(await db
      .select({ key: schema.productMediaThumbnail.imageKey })
      .from(schema.productMediaThumbnail)),
  ];
  await db.$client.unsafe('TRUNCATE "user", permission_group, category, product CASCADE');
  for (const { key } of keys) await deleteObject(key);
  await db.insert(schema.product).values([
    { id: PRODUCT, name: "Hoodie", slug: "hoodie" },
    { id: OTHER_PRODUCT, name: "Cap", slug: "cap" },
  ]);
});

afterAll(async () => {
  s3.destroy();
  await closeDb();
});

describe("productMediaCreate", () => {
  it("uploads JPEG, PNG, GIF and WebP images in sort order", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    for (const [index, format] of (["jpeg", "png", "gif", "webp"] as const).entries()) {
      const result = await postMultipart({
        query: CREATE,
        variables: { input: { product: productId, alt: `Image ${index}`, image: null } },
        file: await imageFile(format),
        token: admin.token,
      });

      expect(result.body.errors).toBeUndefined();
      const created = payload<MediaPayloadData>(result, "productMediaCreate");
      expect(created.errors).toEqual([]);
      const media = created.media;
      if (!media) throw new Error("expected the created media");
      expect(media).toMatchObject({
        alt: `Image ${index}`,
        sortOrder: index,
        type: "IMAGE",
        productId,
      });

      const stored = await fetch(media.url);
      expect(stored.status).toBe(200);
      expect(stored.headers.get("content-type")).toBe(`image/${format}`);
      expect((await stored.arrayBuffer()).byteLength).toBeGreaterThan(0);
    }

    const rows = await db
      .select()
      .from(schema.productMedia)
      .where(eq(schema.productMedia.productId, PRODUCT))
      .orderBy(schema.productMedia.sortOrder);
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(rows.map((row) => row.contentType)).toEqual([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);
  });

  it("requires an image", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await postMultipart({
      query: CREATE,
      variables: { input: { product: productId, alt: "No image" } },
      token: admin.token,
    });

    expect(result.body.errors).toBeUndefined();
    expect(payload<MediaPayloadData>(result, "productMediaCreate")).toEqual({
      product: null,
      media: null,
      errors: [
        {
          field: "input",
          code: "REQUIRED",
          message: "Image or external URL is required.",
        },
      ],
    });
    expect(await objectKeys("products/")).toEqual([]);
  });

  it("rejects a text file renamed .jpg", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const text = new File([Buffer.from("not an image at all")], "photo.jpg", {
      type: "image/jpeg",
    });

    const result = await postMultipart({
      query: CREATE,
      variables: { input: { product: productId, image: null } },
      file: text,
      token: admin.token,
    });

    expect(payload<MediaPayloadData>(result, "productMediaCreate").errors).toEqual([
      { field: "image", code: "INVALID_FILE_TYPE", message: "Invalid file type." },
    ]);
    expect(await objectKeys("products/")).toEqual([]);
  });

  it("rejects an image format we do not accept as an unsupported MIME type", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await postMultipart({
      query: CREATE,
      variables: { input: { product: productId, image: null } },
      // A TIFF cannot be written by sharp's image constructors, but it can make one.
      file: new File([await images.tiff()], "photo.png", { type: "image/png" }),
      token: admin.token,
    });

    expect(payload<MediaPayloadData>(result, "productMediaCreate").errors).toEqual([
      {
        field: "image",
        code: "UNSUPPORTED_MIME_TYPE",
        message:
          "File type not permitted. Contact your administrator or support team to enable " +
          "support for `image/tiff` file type.",
      },
    ]);
    expect(await objectKeys("products/")).toEqual([]);
  });

  it("rejects a truncated JPEG", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const jpeg = await images.jpeg();
    const truncated = jpeg.subarray(0, Math.floor(jpeg.length / 2));

    const result = await postMultipart({
      query: CREATE,
      variables: { input: { product: productId, image: null } },
      file: new File([truncated], "photo.jpg", { type: "image/jpeg" }),
      token: admin.token,
    });

    expect(payload<MediaPayloadData>(result, "productMediaCreate").errors).toEqual([
      { field: "image", code: "INVALID_FILE_TYPE", message: "Invalid file type." },
    ]);
    expect(await objectKeys("products/")).toEqual([]);
  });

  it("rejects a file over 10 MiB", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const tooLarge = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "large.png", {
      type: "image/png",
    });

    const result = await postMultipart({
      query: CREATE,
      variables: { input: { product: productId, image: null } },
      file: tooLarge,
      token: admin.token,
    });

    expect(payload<MediaPayloadData>(result, "productMediaCreate").errors).toEqual([
      {
        field: "image",
        code: "FILE_SIZE_LIMIT_EXCEEDED",
        message: "File size exceeds the maximum allowed size of 10MB.",
      },
    ]);
    expect(await objectKeys("products/")).toEqual([]);
  });

  it("rejects an alt text over 250 characters", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await postMultipart({
      query: CREATE,
      variables: { input: { product: productId, alt: "a".repeat(251), image: null } },
      file: await imageFile("png"),
      token: admin.token,
    });

    expect(payload<MediaPayloadData>(result, "productMediaCreate").errors).toEqual([
      {
        field: "input",
        code: "INVALID",
        message: "Alt field exceeds the character limit of 250.",
      },
    ]);
    expect(await objectKeys("products/")).toEqual([]);
  });

  it("reports an unknown product as a top-level error without writing an object", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const unknown = toGlobalId("Product", MISSING);

    const result = await postMultipart({
      query: CREATE,
      variables: { input: { product: unknown, image: null } },
      file: await imageFile("png"),
      token: admin.token,
    });

    expect(result.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );
    expect(await objectKeys("products/")).toEqual([]);
  });

  it("rejects a multipart request without the CSRF header", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await postMultipart({
      query: CREATE,
      variables: { input: { product: productId, image: null } },
      file: await imageFile("png"),
      token: admin.token,
      csrf: false,
    });

    expect(result.response.status).toBe(403);
    expect(result.body.errors?.[0]?.message).toBe("Required CSRF header(s) not present");
  });
});

describe.each([
  {
    name: "productMediaCreate",
    call: (token?: string) =>
      postMultipart({
        query: CREATE,
        variables: { input: { product: productId, image: null } },
        file: new File([Buffer.alloc(0)], "image.png"),
        token,
      }),
  },
  {
    name: "productMediaUpdate",
    call: (token?: string) =>
      client.gql(UPDATE, { id: unknownMedia, input: { alt: "Changed" } }, token),
  },
  {
    name: "productMediaDelete",
    call: (token?: string) => client.gql(DELETE, { id: unknownMedia }, token),
  },
  {
    name: "productMediaReorder",
    call: (token?: string) => client.gql(REORDER, { productId, mediaIds: [] }, token),
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

/** A media row inserted directly, for the mutations other than create. */
async function insertMedia(id: string, { alt = "", sortOrder = 0, productIdValue = PRODUCT } = {}) {
  const [row] = await db
    .insert(schema.productMedia)
    .values({
      id,
      productId: productIdValue,
      imageKey: `products/${productIdValue}/${id}.jpg`,
      contentType: "image/jpeg",
      alt,
      sortOrder,
    })
    .returning();
  if (!row) throw new Error("no media row");
  return row;
}

describe("productMediaUpdate", () => {
  it("updates the alt text", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(410), { alt: "Before" });

    const result = await client.gql(
      UPDATE,
      { id: mediaId(media.id), input: { alt: "After" } },
      admin.token,
    );

    expect(result.body.errors).toBeUndefined();
    expect(payload<MediaPayloadData>(result, "productMediaUpdate")).toMatchObject({
      media: { id: mediaId(media.id), alt: "After" },
      errors: [],
    });
    const [row] = await db
      .select()
      .from(schema.productMedia)
      .where(eq(schema.productMedia.id, media.id));
    expect(row?.alt).toBe("After");
  });

  it("rejects an alt text over 250 characters", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(411));

    const result = await client.gql(
      UPDATE,
      { id: mediaId(media.id), input: { alt: "a".repeat(251) } },
      admin.token,
    );

    expect(payload<MediaPayloadData>(result, "productMediaUpdate")).toMatchObject({
      media: null,
      errors: [
        {
          field: "input",
          code: "INVALID",
          message: "Alt field exceeds the character limit of 250.",
        },
      ],
    });
  });

  it("reports an unknown media id as a top-level error", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await client.gql(
      UPDATE,
      { id: unknownMedia, input: { alt: "Missing" } },
      admin.token,
    );

    expect(result.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknownMedia}"]'.`,
    );
  });
});

describe("productMediaDelete", () => {
  it("deletes the row, its object and its thumbnails' objects", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const media = await insertMedia(ID(420), { alt: "Gone" });
    const thumbnailKey = `thumbnails/${media.id}/128.jpg`;
    const bytes = await images.jpeg();
    await putObject(media.imageKey, bytes);
    await putObject(thumbnailKey, bytes);
    await db.insert(schema.productMediaThumbnail).values({
      mediaId: media.id,
      size: 128,
      format: "ORIGINAL",
      imageKey: thumbnailKey,
    });

    const result = await client.gql(DELETE, { id: mediaId(media.id) }, admin.token);

    expect(result.body.errors).toBeUndefined();
    expect(payload<MediaPayloadData>(result, "productMediaDelete")).toMatchObject({
      media: { id: mediaId(media.id), alt: "Gone" },
      errors: [],
    });
    expect(await db.select().from(schema.productMedia)).toEqual([]);
    expect(await db.select().from(schema.productMediaThumbnail)).toEqual([]);
    expect(await objectKeys("products/")).toEqual([]);
    expect(await objectKeys("thumbnails/")).toEqual([]);
  });

  it("reports an unknown media id as a top-level error", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);

    const result = await client.gql(DELETE, { id: unknownMedia }, admin.token);

    expect(result.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknownMedia}"]'.`,
    );
  });
});

describe("productMediaReorder", () => {
  it("sets each media's sort order to its position in the list", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const first = await insertMedia(ID(430), { sortOrder: 0 });
    const second = await insertMedia(ID(431), { sortOrder: 1 });
    const third = await insertMedia(ID(432), { sortOrder: 2 });
    const order = [third.id, first.id, second.id];

    const result = await client.gql(
      REORDER,
      { productId, mediaIds: order.map(mediaId) },
      admin.token,
    );

    expect(result.body.errors).toBeUndefined();
    const reordered = payload<ReorderPayloadData>(result, "productMediaReorder");
    expect(reordered.errors).toEqual([]);
    expect(reordered.media).toEqual(
      order.map((id, index) => ({ id: mediaId(id), sortOrder: index })),
    );

    const rows = await db
      .select()
      .from(schema.productMedia)
      .where(eq(schema.productMedia.productId, PRODUCT))
      .orderBy(schema.productMedia.sortOrder);
    expect(rows.map((row) => row.id)).toEqual(order);
  });

  it("rejects a list that is not the product's whole media set", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const first = await insertMedia(ID(433), { sortOrder: 0 });
    await insertMedia(ID(434), { sortOrder: 1 });

    const result = await client.gql(
      REORDER,
      { productId, mediaIds: [mediaId(first.id)] },
      admin.token,
    );

    expect(payload<ReorderPayloadData>(result, "productMediaReorder").errors).toEqual([
      { field: "order", code: "INVALID", message: "Incorrect number of media IDs provided." },
    ]);
  });

  it("rejects a media id of another product", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const own = await insertMedia(ID(435), { sortOrder: 0 });
    await insertMedia(ID(439), { sortOrder: 1 });
    const foreign = await insertMedia(ID(436), { sortOrder: 0, productIdValue: OTHER_PRODUCT });

    const result = await client.gql(
      REORDER,
      { productId, mediaIds: [mediaId(own.id), mediaId(foreign.id)] },
      admin.token,
    );

    expect(payload<ReorderPayloadData>(result, "productMediaReorder").errors).toEqual([
      {
        field: "order",
        code: "NOT_PRODUCTS_IMAGE",
        message: `Media ${mediaId(foreign.id)} does not belong to this product.`,
      },
    ]);
  });

  it("rejects a duplicated media id", async () => {
    const admin = await createStaff(db, ["MANAGE_PRODUCTS"]);
    const own = await insertMedia(ID(437), { sortOrder: 0 });
    await insertMedia(ID(438), { sortOrder: 1 });

    const result = await client.gql(
      REORDER,
      { productId, mediaIds: [mediaId(own.id), mediaId(own.id)] },
      admin.token,
    );

    expect(payload<ReorderPayloadData>(result, "productMediaReorder").errors).toEqual([
      {
        field: "order",
        code: "NOT_PRODUCTS_IMAGE",
        message: `Media ${mediaId(own.id)} does not belong to this product.`,
      },
    ]);
  });
});
