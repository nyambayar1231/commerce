import "server-only";

import { connection } from "next/server";
import { CollectionBySlugDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import { toCollection } from "./mappers";
import type { CollectionView } from "./types";

// Same loader pattern as `categories.ts`: `connection()` first, then a `"use cache"` inner with
// normalized arguments. Unpublished collections are `null` for an anonymous storefront.

async function getCollectionCached(slug: string): Promise<CollectionView | null> {
  "use cache";
  const data = await cachedQuery(CollectionBySlugDocument, {
    variables: { slug },
    tags: [tags.collection(slug)],
  });
  return data.collection === null ? null : toCollection(data.collection);
}

/** A collection by slug; `null` when no such collection is published. */
export async function getCollection(slug: string): Promise<CollectionView | null> {
  await connection();
  return getCollectionCached(slug);
}

// Also imported by `listing.ts` (see the note in `categories.ts`).
export { getCollectionCached };
