// View models of the catalog listing pages (ARCHITECTURE §10.3). `src/ui/**` imports these
// types (and only these from `src/lib`); `src/lib/catalog` turns generated GraphQL types into
// them, so no component ever sees an API shape, and money reaches the UI already formatted.

import type { RichTextBlock } from "@/lib/content/types";

/** The sort orders a listing page offers. */
export type ListingSort = "newest" | "price-asc" | "price-desc" | "name-asc";

/**
 * A listing's URL state, parsed and normalized by `listing-params.ts`: unknown values dropped,
 * defaults filled in. Numbers are whole MNT amounts.
 */
export type ListingParams = {
  sort: ListingSort;
  minPrice?: number;
  maxPrice?: number;
  /** Filter category slug. */
  category?: string;
  /** Filter collection slug. */
  collection?: string;
  after?: string;
  before?: string;
};

/** What a listing lists: everything, one category (with its descendants), or one collection. */
export type ListingScope =
  | { kind: "all" }
  | { kind: "category"; id: string; slug: string }
  | { kind: "collection"; id: string; slug: string };

/** One image of a card, ready for `<img src srcSet sizes>`: the API's stored WebP thumbnails. */
export type ProductCardImage = {
  /** The smaller rung; also the `src` for browsers that ignore `srcSet`. */
  src: string;
  srcSet: string;
  /** The media's alt text, falling back to the product name. */
  alt: string;
};

/** One cell of the product grid. Money is already a formatted string (formatting is server-side). */
export type ProductCardView = {
  id: string;
  name: string;
  href: string;
  categoryName: string | null;
  image: ProductCardImage | null;
  price: string | null;
  /** True when the variants' prices differ, so the price is a starting price. */
  priceFrom: boolean;
  /** True when every variant is tracked and out of stock; untracked (`null`) counts as available. */
  soldOut: boolean;
  /**
   * The variant the card's quick-add button adds: set only when the product has exactly one
   * variant and it is not sold out. Otherwise null: the shopper chooses on the product page.
   */
  quickAddVariantId: string | null;
};

export type PageInfoView = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

/** A listing page's data: the grid's cards, the total after filters, and the cursor window. */
export type ListingView = {
  items: ProductCardView[];
  totalCount: number | null;
  pageInfo: PageInfoView;
};

/** A category's child categories, shown as links on a category page. */
export type CategoryChildView = { name: string; slug: string };

export type CategoryView = {
  id: string;
  name: string;
  slug: string;
  children: CategoryChildView[];
};

export type CollectionView = {
  id: string;
  name: string;
  slug: string;
};

/** The filter bar's option lists: categories indented by `level`, then collections. */
export type FilterOptionsView = {
  categories: { name: string; slug: string; level: number }[];
  collections: { name: string; slug: string }[];
};

// ---------------------------------------------------------------------------
// Product page (M4.3)
// ---------------------------------------------------------------------------

/**
 * One gallery image, ready for `<img src srcSet sizes>`: the API's stored WebP thumbnails
 * (ARCHITECTURE §10.12) — the 128 rung for the thumbnail strip, the 1024 rung as the stage's
 * `src`, and the 2048 rung for the fullscreen viewer.
 */
export type ProductViewImage = {
  /** The product media id; a variant's selected images are matched by it. */
  id: string;
  /** The media's alt text, falling back to the product name. */
  alt: string;
  /** The 128px rung (the thumbnail strip). */
  thumb: string;
  /** The 1024px rung: the main stage's `src`. */
  src: string;
  /** `"<medium> 1024w, <large> 2048w"`. */
  srcSet: string;
  /** The 2048px rung: the fullscreen viewer's image. */
  large: string;
};

/** A variant's stock state, from `quantityAvailable` (ARCHITECTURE §3: available = quantity − allocated). */
export type VariantStock = "inStock" | "lowStock" | "outOfStock";

/** One variant as the buy box shows it. Money is already a formatted string (server-side). */
export type VariantView = {
  id: string;
  name: string;
  sku: string | null;
  /** The variant's price, formatted on the server (§10.11). */
  price: string;
  /** The price in major units, for JSON-LD only. */
  priceAmount: number;
  stock: VariantStock;
  /** How many are left; present only when `stock` is `lowStock`. */
  quantity: number | null;
  /** The product media ids assigned to this variant (the gallery puts them first). */
  mediaIds: string[];
};

/**
 * A product page's data (M4.3). `breadcrumbs` holds the category trail — the ancestors from the
 * root down, then the product's own category; the page adds the translated Home crumb in front
 * and the product itself as the current crumb.
 */
export type ProductView = {
  id: string;
  name: string;
  slug: string;
  /** The canonical path, `/products/<slug>`. */
  url: string;
  /** The description as sanitized blocks; rendered with `RichText`, never raw HTML. */
  description: RichTextBlock[];
  /** Plain text of the description, cut at 160 characters, for metadata. */
  descriptionText: string;
  /** The category trail: ancestors root first, then the category; empty without a category. */
  breadcrumbs: { name: string; href: string }[];
  images: ProductViewImage[];
  variants: VariantView[];
  /** The lowest and highest variant price, formatted; `max` is null when they are equal. */
  priceRange: { min: string; max: string | null };
};

// ---------------------------------------------------------------------------
// Listing filter bar (M4.13a)
// ---------------------------------------------------------------------------

/** A price range's ends as formatted money ("₮ 50,000"); a missing end is open. */
export type PriceRangeText = { min?: string; max?: string };

/**
 * One option of a filter pill, with its target URL. `kind` says how the UI words it: the "all"
 * option, a named category or collection (`label`), or a price range (`price`).
 */
export type FilterChoiceView = {
  key: string;
  kind: "all" | "named" | "price";
  label?: string;
  price?: PriceRangeText;
  href: string;
  selected: boolean;
  /** Indentation steps, for nested categories. */
  level?: number;
};

export type FilterGroupView = {
  id: "category" | "collection" | "price";
  /** Paper's badge: how many values of this filter are set. */
  count: number;
  /** A hand-typed price range the presets don't know: the price pill shows it as its label. */
  customPrice?: PriceRangeText;
  choices: FilterChoiceView[];
};

export type SortChoiceView = { sort: ListingSort; href: string; selected: boolean };

/** Everything the filter bar renders, with every URL built: the UI only words and lays it out. */
export type FilterBarView = {
  groups: FilterGroupView[];
  sortChoices: SortChoiceView[];
  /** Changes whenever the URL state does: the bar remounts, which closes an open panel. */
  key: string;
};
