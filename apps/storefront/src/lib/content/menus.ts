import "server-only";

import { connection } from "next/server";
import { MenuBySlugDocument } from "@/gql/graphql";
import { cachedQuery, tags } from "@/lib/api";
import type { MenuItemView } from "./types";

// The `navbar` and `footer` menus (ARCHITECTURE §10.3, §10.7). The loader follows the M4.1b
// pattern: `await connection()` first — no API call at build time — then a `"use cache"` inner
// with a normalized argument, tagged `menu:<slug>`. The mapping below is pure and unit-tested
// with fixtures (the owner's menus are real data, never test data).

/**
 * One item of the query's three-level tree, structural: the deepest level requests no
 * `children`, so the field is optional and every level fits the same mapper.
 */
type MenuQueryItem = {
  id: string;
  name: string;
  url: string | null;
  category: { slug: string } | null;
  collection: { slug: string } | null;
  page: { slug: string } | null;
  children?: readonly MenuQueryItem[];
};

/** Only absolute http(s) URLs are external (the API stores no other kind, this re-checks). */
const EXTERNAL_HREF = /^https?:\/\//i;

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

const SAME_ORIGIN_BASE = "http://same-origin.invalid";

/**
 * A menu item's URL when it is a safe same-site relative path, else null. The rules are
 * `safe-redirect.ts`'s: exactly one leading `/`, no `//`, backslash, encoded slash or control
 * character, and it must parse as a same-origin relative URL. Anything else is dropped.
 */
export function safeRelativeHref(url: string): string | null {
  if (!url.startsWith("/")) return null;
  if (url.includes("//") || url.includes("\\") || /%2f|%5c/i.test(url)) return null;
  if (hasControlCharacter(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url, SAME_ORIGIN_BASE);
  } catch {
    return null;
  }
  if (parsed.origin !== SAME_ORIGIN_BASE) return null;
  return `${parsed.pathname}${parsed.search}`;
}

/** The link a menu item points at: its category, collection or page, else its URL (brief, M4.4). */
function linkOf(item: MenuQueryItem): { href: string; external: boolean } | null {
  if (item.category !== null) return { href: `/categories/${item.category.slug}`, external: false };
  if (item.collection !== null)
    return { href: `/collections/${item.collection.slug}`, external: false };
  if (item.page !== null) return { href: `/pages/${item.page.slug}`, external: false };
  if (item.url !== null && EXTERNAL_HREF.test(item.url)) return { href: item.url, external: true };
  if (item.url !== null) {
    const href = safeRelativeHref(item.url);
    if (href !== null) return { href, external: false };
  }
  return null;
}

/**
 * The query's items as the nav tree: category → `/categories/<slug>`, collection →
 * `/collections/<slug>`, page → `/pages/<slug>`, else the `url` when it is an http(s) URL
 * (external) or a safe relative path. An item with none of these — no target, an unpublished
 * target, an unsafe URL — is dropped, with its subtree.
 */
export function toMenuItems(items: readonly MenuQueryItem[]): MenuItemView[] {
  const out: MenuItemView[] = [];
  for (const item of items) {
    const link = linkOf(item);
    if (link === null) continue;
    out.push({
      id: item.id,
      name: item.name,
      href: link.href,
      external: link.external,
      children: toMenuItems(item.children ?? []),
    });
  }
  return out;
}

async function getMenuCached(slug: string): Promise<MenuItemView[]> {
  "use cache";
  const data = await cachedQuery(MenuBySlugDocument, {
    variables: { slug },
    tags: [tags.menu(slug)],
  });
  return toMenuItems(data.menu?.items ?? []);
}

/** A menu's items as the nav tree; a missing menu is an empty tree, never an error. */
export async function getMenu(slug: string): Promise<MenuItemView[]> {
  await connection();
  return getMenuCached(slug);
}
