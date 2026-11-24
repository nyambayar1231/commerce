// View models of the catalog listing pages (ARCHITECTURE §10.3). `src/ui/**` imports these
// types (and only these from `src/lib`); `src/lib/catalog` turns generated GraphQL types into
// them, so no component ever sees an API shape, and money reaches the UI already formatted.

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
