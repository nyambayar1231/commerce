import "server-only";

import { connection } from "next/server";
import { ShopInfoDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";

async function getShopCached(): Promise<{ name: string }> {
  "use cache";
  const data = await cachedQuery(ShopInfoDocument, { tags: [tags.shop] });
  return { name: data.shop.name };
}

/**
 * The shop's public facts. `connection()` first: no API call at build time (ARCHITECTURE §10.7),
 * so the shell prerenders and this renders per request from the shared cache.
 */
export async function getShop(): Promise<{ name: string }> {
  await connection();
  return getShopCached();
}
