import "server-only";

import { connection } from "next/server";
import { CategorySeoDocument, CollectionSeoDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import { firstParagraphDescription } from "./description";

// Meta descriptions of categories and collections (their catalog views carry no description).
// Same loader pattern as `collections.ts`: `connection()` first, then a cached inner function.

async function getCategoryDescriptionCached(slug: string): Promise<string> {
  "use cache";
  const data = await cachedQuery(CategorySeoDocument, {
    variables: { slug },
    tags: [tags.category(slug)],
  });
  return firstParagraphDescription(data.category?.description);
}

async function getCollectionDescriptionCached(slug: string): Promise<string> {
  "use cache";
  const data = await cachedQuery(CollectionSeoDocument, {
    variables: { slug },
    tags: [tags.collection(slug)],
  });
  return firstParagraphDescription(data.collection?.description);
}

/** The category's description text; "" when it has none. */
export async function getCategoryDescription(slug: string): Promise<string> {
  await connection();
  return getCategoryDescriptionCached(slug);
}

/** The collection's description text; "" when it has none. */
export async function getCollectionDescription(slug: string): Promise<string> {
  await connection();
  return getCollectionDescriptionCached(slug);
}
