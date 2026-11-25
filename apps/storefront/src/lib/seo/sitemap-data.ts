import "server-only";

import { connection } from "next/server";
import {
  SitemapCategoriesDocument,
  SitemapCollectionsDocument,
  SitemapPagesDocument,
  SitemapProductsDocument,
} from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import {
  collectAll,
  type ListPage,
  SITEMAP_PAGE_SIZE,
  type SitemapItem,
  type SitemapLists,
} from "./sitemap";

// Every public product, category, collection and page for the sitemap, through the shared cache
// (one crawl per list per cache lifetime, not per request). `cachedQuery` throws on an API
// failure, so Next caches no outage and the sitemap answers 5xx. The API returns only published
// items to an anonymous caller. The `*` slugs only give each list its own tag.

type Edges = {
  edges: { node: SitemapItem }[];
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
};

function toListPage(connectionData: Edges | null | undefined): ListPage {
  return {
    items: connectionData?.edges.map((edge) => edge.node) ?? [],
    hasNextPage: connectionData?.pageInfo.hasNextPage ?? false,
    endCursor: connectionData?.pageInfo.endCursor ?? null,
  };
}

async function getProductsCached(): Promise<SitemapItem[]> {
  "use cache";
  return collectAll("products", async (after) =>
    toListPage(
      (
        await cachedQuery(SitemapProductsDocument, {
          variables: { first: SITEMAP_PAGE_SIZE, after },
          tags: [tags.products],
        })
      ).products,
    ),
  );
}

async function getCategoriesCached(): Promise<SitemapItem[]> {
  "use cache";
  return collectAll("categories", async (after) =>
    toListPage(
      (
        await cachedQuery(SitemapCategoriesDocument, {
          variables: { first: SITEMAP_PAGE_SIZE, after },
          tags: [tags.category("*")],
        })
      ).categories,
    ),
  );
}

async function getCollectionsCached(): Promise<SitemapItem[]> {
  "use cache";
  return collectAll("collections", async (after) =>
    toListPage(
      (
        await cachedQuery(SitemapCollectionsDocument, {
          variables: { first: SITEMAP_PAGE_SIZE, after },
          tags: [tags.collection("*")],
        })
      ).collections,
    ),
  );
}

async function getPagesCached(): Promise<SitemapItem[]> {
  "use cache";
  return collectAll("pages", async (after) =>
    toListPage(
      (
        await cachedQuery(SitemapPagesDocument, {
          variables: { first: SITEMAP_PAGE_SIZE, after },
          tags: [tags.page("*")],
        })
      ).pages,
    ),
  );
}

/** All four lists. `connection()` first: no API call at build time (§10.7). */
export async function getSitemapLists(): Promise<SitemapLists> {
  await connection();
  const [products, categories, collections, pages] = await Promise.all([
    getProductsCached(),
    getCategoriesCached(),
    getCollectionsCached(),
    getPagesCached(),
  ]);
  return { products, categories, collections, pages };
}
