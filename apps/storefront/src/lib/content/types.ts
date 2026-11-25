// View models of `src/lib/content` (ARCHITECTURE §10.3): what `src/ui` may import from here.

import type { ProductCardView } from "@/lib/catalog/types";

/**
 * One rendered EditorJS block. Every `html` is already sanitized to the inline allowlist in
 * `rich-text.ts` (`b i u s a br strong em`, safe links); the UI may insert it as HTML.
 */
export type RichTextBlock =
  | { type: "paragraph"; html: string }
  | { type: "heading"; level: 2 | 3 | 4; html: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; html: string };

/** One navigation item (`navbar`, `footer`), already mapped to a link; dropped items never appear. */
export type MenuItemView = {
  id: string;
  name: string;
  href: string;
  /** True when `href` is another site: opens in a new tab without a referrer. */
  external: boolean;
  children: MenuItemView[];
};

/** A CMS page (ARCHITECTURE §10.13): title, sanitized blocks and a plain-text meta description. */
export type PageView = {
  title: string;
  content: RichTextBlock[];
  descriptionText: string;
};

/** The home featured-collection section: the collection's name and its first products. */
export type FeaturedCollectionView = {
  name: string;
  items: ProductCardView[];
};

/** One home category tile: a top-level category's name and slug. */
export type CategoryTileView = { name: string; slug: string };
