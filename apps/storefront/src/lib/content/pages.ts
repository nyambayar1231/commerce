import "server-only";

import { connection } from "next/server";
import type { PageBySlugQuery } from "@/gql/graphql";
import { PageBySlugDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import { parseRichText, richTextToPlainText } from "./rich-text";
import type { PageView } from "./types";

// A CMS page (ARCHITECTURE §10.7, §10.13). Same loader pattern as `shop.ts` and `menus.ts`; the
// API hides unpublished pages from the storefront, so a missing page is plain `null` (the route
// turns that into the Mongolian 404), never a cached error.

/** The query's page as the route's view: sanitized blocks plus the plain-text description. */
export function toPageView(page: NonNullable<PageBySlugQuery["page"]>): PageView {
  return {
    title: page.title,
    content: parseRichText(page.content),
    descriptionText: richTextToPlainText(page.content),
  };
}

async function getPageCached(slug: string): Promise<PageView | null> {
  "use cache";
  const data = await cachedQuery(PageBySlugDocument, {
    variables: { slug },
    tags: [tags.page(slug)],
  });
  return data.page === null ? null : toPageView(data.page);
}

/** A published page by slug, with its description text; `null` when no such page exists. */
export async function getPage(slug: string): Promise<PageView | null> {
  await connection();
  return getPageCached(slug);
}
