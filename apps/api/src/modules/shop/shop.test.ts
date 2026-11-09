import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.ts";

// The real app and the real (test) database; requests go through Yoga in-process, no network.
const app = createApp(getDb(), { allowedOrigins: ["http://localhost:5173"] });

afterAll(async () => {
  await closeDb();
});

async function postGraphQL(query: string) {
  const response = await app.fetch("http://test/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: response.status, body: await response.json() };
}

describe("Query.shop", () => {
  it("returns the shop seeded by migration 0001", async () => {
    const result = await postGraphQL("{ shop { name currency } }");

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ data: { shop: { name: "Hantesi-Mongolia", currency: "MNT" } } });
  });

  it("rejects a GET without the CSRF header", async () => {
    const query = encodeURIComponent("{ shop { name } }");
    const response = await app.fetch(`http://test/graphql?query=${query}`);

    expect(response.status).toBe(403);
  });
});

describe("shop_settings table", () => {
  it("cannot hold a second row", async () => {
    const insertSecond = getDb()
      .insert(schema.shopSettings)
      .values({ id: 2, name: "Other", currency: "MNT", defaultCountry: "MN" });

    // Drizzle wraps the driver error; the constraint name is on its `cause`.
    await expect(insertSecond).rejects.toMatchObject({
      cause: { constraint_name: "shop_settings_single_row" },
    });
  });
});
