import "server-only";

import { connection } from "next/server";
import { ProductDetailsDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import { toProduct } from "./product-mappers";
import type { ProductView } from "./types";

// The product page's loader (M4.1b pattern, ARCHITECTURE §10.7): the public function awaits
// `connection()` first — so no API call happens at build time — then a `"use cache"` inner
// receives only the slug. `cachedQuery` throws on failure, so an outage is never cached and
// never becomes a 404; a missing product without errors is plain `null`.

async function getProductCached(slug: string): Promise<ProductView | null> {
  "use cache";
  const data = await cachedQuery(ProductDetailsDocument, {
    variables: { slug },
    tags: [tags.products, tags.product(slug)],
  });
  return data.product === null ? null : toProduct(data.product);
}

/** A published product by slug, with its variants, media and category trail; `null` if none. */
export async function getProduct(slug: string): Promise<ProductView | null> {
  await connection();
  return getProductCached(slug);
}
