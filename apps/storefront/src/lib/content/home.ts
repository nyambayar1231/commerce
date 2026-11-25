import "server-only";

import { connection } from "next/server";
import { FeaturedCollectionDocument, HomeCategoriesDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import { toProductCard } from "@/lib/catalog/mappers";
import type { CategoryTileView, FeaturedCollectionView } from "./types";

// The home page's two data islands (ARCHITECTURE §10.4, §10.7), same loader pattern as
// `catalog/listing.ts`: `connection()` first, then `"use cache"` inners with normalized
// arguments. Both sections hide themselves when there is nothing to show.

/** The featured collection's slug (M4.4); the section is hidden while it doesn't exist. */
export const FEATURED_COLLECTION_SLUG = "featured-products";

/** The featured collection's first products; `null` when the collection is missing or empty. */
export async function getFeaturedCollection(): Promise<FeaturedCollectionView | null> {
  await connection();
  return getFeaturedCollectionCached();
}

async function getFeaturedCollectionCached(): Promise<FeaturedCollectionView | null> {
  "use cache";
  const data = await cachedQuery(FeaturedCollectionDocument, {
    variables: { slug: FEATURED_COLLECTION_SLUG },
    tags: [tags.collection(FEATURED_COLLECTION_SLUG), tags.products],
  });
  const collection = data.collection;
  if (collection === null) return null;
  const items = (collection.products?.edges ?? []).map((edge) => toProductCard(edge.node));
  return items.length === 0 ? null : { name: collection.name, items };
}

/** The top-level categories shown as the home tile grid; empty when there are none. */
export async function getHomeCategories(): Promise<CategoryTileView[]> {
  await connection();
  return getHomeCategoriesCached();
}

async function getHomeCategoriesCached(): Promise<CategoryTileView[]> {
  "use cache";
  // There is no categories-list tag in `tags` yet; the products tag covers the same staff
  // catalog edits (the same choice `getFilterOptionsCached` makes).
  const data = await cachedQuery(HomeCategoriesDocument, { tags: [tags.products] });
  return data.categories?.edges.map((edge) => ({ ...edge.node })) ?? [];
}
