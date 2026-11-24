import "server-only";

import { connection } from "next/server";
import { CategoryBySlugDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import { toCategory } from "./mappers";
import type { CategoryView } from "./types";

// The M4.1b loader pattern (ARCHITECTURE §10.7): a public function awaits `connection()` first —
// so no API call happens at build time — then calls a `"use cache"` inner that receives only
// normalized, serializable arguments. `cachedQuery` throws on failure, so an outage is never
// cached and never becomes a 404; a missing category without errors is plain `null`.

async function getCategoryCached(slug: string): Promise<CategoryView | null> {
  "use cache";
  const data = await cachedQuery(CategoryBySlugDocument, {
    variables: { slug },
    tags: [tags.category(slug)],
  });
  return data.category === null ? null : toCategory(data.category);
}

/** A category by slug, with its child categories; `null` when no such category is published. */
export async function getCategory(slug: string): Promise<CategoryView | null> {
  await connection();
  return getCategoryCached(slug);
}

// Also imported by `listing.ts`, which resolves a filter slug to an id inside its own request
// scope (never inside a `"use cache"` function that would read request data).
export { getCategoryCached };
