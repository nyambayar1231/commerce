import { mnt } from "@commerce/contracts";
import { formatMoney } from "@/lib/format";
import { listingHref, listingSearchParams } from "./listing-params";
import type {
  FilterBarView,
  FilterChoiceView,
  FilterGroupView,
  FilterOptionsView,
  ListingParams,
  ListingSort,
  PriceRangeText,
} from "./types";

// The filter bar's view model (ARCHITECTURE §10.3): every option's URL is the current listing URL
// with exactly one field changed (`listingHref` drops the cursors, so a choice restarts at page
// one). Pure and server-side, so each target is unit-tested and the UI never builds a URL.

/** A preset price range, in whole MNT; a missing end is open. */
export type PriceRange = { min?: number; max?: number };

/** The price pill's presets (Paper offers ranges too): the first has no minimum, the last no
 * maximum. */
export const PRICE_RANGES: readonly PriceRange[] = [
  { max: 50_000 },
  { min: 50_000, max: 100_000 },
  { min: 100_000, max: 200_000 },
  { min: 200_000 },
];

const SORTS: readonly ListingSort[] = ["newest", "price-asc", "price-desc", "name-asc"];

/** `true` when the URL's price filter is exactly this range. */
export function isPriceRangeSelected(params: ListingParams, range: PriceRange): boolean {
  return params.minPrice === range.min && params.maxPrice === range.max;
}

/** The URL that selects a category; `undefined` is "all categories". */
export function categoryHref(basePath: string, params: ListingParams, slug: string | undefined) {
  return listingHref(basePath, params, { category: slug });
}

/** The URL that selects a collection; `undefined` is "all collections". */
export function collectionHref(basePath: string, params: ListingParams, slug: string | undefined) {
  return listingHref(basePath, params, { collection: slug });
}

/** The URL that selects a price range; `null` clears both ends ("all prices"). */
export function priceHref(basePath: string, params: ListingParams, range: PriceRange | null) {
  return listingHref(basePath, params, { minPrice: range?.min, maxPrice: range?.max });
}

/** The URL that changes the sort. */
export function sortHref(basePath: string, params: ListingParams, sort: ListingSort) {
  return listingHref(basePath, params, { sort });
}

function priceText(range: PriceRange): PriceRangeText {
  return {
    ...(range.min !== undefined ? { min: formatMoney(mnt(range.min)) } : {}),
    ...(range.max !== undefined ? { max: formatMoney(mnt(range.max)) } : {}),
  };
}

/** Builds the bar's groups (the hidden one left out), sort options and remount key. */
export function buildFilterBarView(
  basePath: string,
  params: ListingParams,
  options: FilterOptionsView,
  hide: "category" | "collection" | null,
): FilterBarView {
  const groups: FilterGroupView[] = [];

  if (hide !== "category" && options.categories.length > 0) {
    // A slug the option list doesn't know can't be shown as selected; the listing ignores it.
    const selected = options.categories.some((option) => option.slug === params.category)
      ? params.category
      : undefined;
    groups.push({
      id: "category",
      count: selected === undefined ? 0 : 1,
      choices: [
        {
          key: "all",
          kind: "all",
          href: categoryHref(basePath, params, undefined),
          selected: selected === undefined,
        },
        ...options.categories.map(
          (option): FilterChoiceView => ({
            key: option.slug,
            kind: "named",
            label: option.name,
            href: categoryHref(basePath, params, option.slug),
            selected: option.slug === selected,
            level: option.level,
          }),
        ),
      ],
    });
  }

  if (hide !== "collection" && options.collections.length > 0) {
    const selected = options.collections.some((option) => option.slug === params.collection)
      ? params.collection
      : undefined;
    groups.push({
      id: "collection",
      count: selected === undefined ? 0 : 1,
      choices: [
        {
          key: "all",
          kind: "all",
          href: collectionHref(basePath, params, undefined),
          selected: selected === undefined,
        },
        ...options.collections.map(
          (option): FilterChoiceView => ({
            key: option.slug,
            kind: "named",
            label: option.name,
            href: collectionHref(basePath, params, option.slug),
            selected: option.slug === selected,
          }),
        ),
      ],
    });
  }

  const priceSet = params.minPrice !== undefined || params.maxPrice !== undefined;
  const preset = PRICE_RANGES.some((range) => isPriceRangeSelected(params, range));
  groups.push({
    id: "price",
    count: priceSet ? 1 : 0,
    ...(priceSet && !preset
      ? {
          customPrice: priceText({
            ...(params.minPrice !== undefined ? { min: params.minPrice } : {}),
            ...(params.maxPrice !== undefined ? { max: params.maxPrice } : {}),
          }),
        }
      : {}),
    choices: [
      { key: "all", kind: "all", href: priceHref(basePath, params, null), selected: !priceSet },
      ...PRICE_RANGES.map(
        (range): FilterChoiceView => ({
          key: `${range.min ?? ""}-${range.max ?? ""}`,
          kind: "price",
          price: priceText(range),
          href: priceHref(basePath, params, range),
          selected: isPriceRangeSelected(params, range),
        }),
      ),
    ],
  });

  return {
    groups,
    sortChoices: SORTS.map((sort) => ({
      sort,
      href: sortHref(basePath, params, sort),
      selected: params.sort === sort,
    })),
    key: `${basePath}?${listingSearchParams(params)}`,
  };
}
