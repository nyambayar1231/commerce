// Adapted from saleor-storefront: src/ui/components/plp/filter-bar.tsx and the category, price and
// sort parts of use-product-filters.ts (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { FilterOptionsView, ListingParams } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { buttonClassName } from "@/ui/components/ui/button";
import { AutoSubmitSelect } from "./auto-submit-select";

interface FilterBarProps {
  /** The GET form's target: the page's own path, without a query. */
  basePath: string;
  /** The listing's current, normalized URL state. */
  params: ListingParams;
  options: FilterOptionsView;
  /** The select this page hides, because the route itself is that category or collection. */
  hide: "category" | "collection" | null;
  /** A URL that clears the filters but keeps the sort, built by the page island. */
  clearHref: string;
}

const CONTROL_CLASS =
  "h-9 rounded-button border border-input bg-background px-3 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const LABEL_CLASS = "text-sm text-muted-foreground";
// @tailwindcss/forms draws a select's arrow inside a 2.5rem right padding; `px-3` would put the
// text under it.
const SELECT_CLASS = cn(CONTROL_CLASS, "pr-9");

/** `true` when any filter (not the sort) is set: the "clear filters" link and the filtered
 * empty state both key off it. */
export function hasListingFilters(params: ListingParams): boolean {
  return (
    params.category !== undefined ||
    params.collection !== undefined ||
    params.minPrice !== undefined ||
    params.maxPrice !== undefined
  );
}

/**
 * The listing's filter bar as a plain `<form method="get">`: labelled selects for category,
 * collection and sort, two number inputs for the price range, an apply button. It works without
 * JavaScript; `AutoSubmitSelect` additionally navigates on select change. Changing a filter
 * drops the cursors (a GET form carries only its own controls, so `after`/`before` vanish).
 */
export function FilterBar({ basePath, params, options, hide, clearHref }: FilterBarProps) {
  const t = useTranslations("plp");
  // A slug the option lists don't know can't be represented by the select; the listing ignores
  // it, so the select shows "all" for it.
  const categoryValue = options.categories.some((option) => option.slug === params.category)
    ? params.category
    : "";
  const collectionValue = options.collections.some((option) => option.slug === params.collection)
    ? params.collection
    : "";

  return (
    <form
      method="get"
      action={basePath}
      aria-label={t("filters")}
      className="sticky top-16 z-30 border-b border-border bg-background"
    >
      <div className="container-content py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {hide !== "category" && (
            <div className="flex items-center gap-2">
              <label htmlFor="plp-filter-category" className={LABEL_CLASS}>
                {t("filterCategory")}
              </label>
              <AutoSubmitSelect
                id="plp-filter-category"
                name="category"
                defaultValue={categoryValue}
                className={SELECT_CLASS}
              >
                <option value="">{t("allCategories")}</option>
                {options.categories.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {`\u00A0\u00A0`.repeat(option.level)}
                    {option.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            </div>
          )}

          {hide !== "collection" && (
            <div className="flex items-center gap-2">
              <label htmlFor="plp-filter-collection" className={LABEL_CLASS}>
                {t("filterCollection")}
              </label>
              <AutoSubmitSelect
                id="plp-filter-collection"
                name="collection"
                defaultValue={collectionValue}
                className={SELECT_CLASS}
              >
                <option value="">{t("allCollections")}</option>
                {options.collections.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="plp-filter-price-min" className={LABEL_CLASS}>
              {t("filterPriceMin")}
            </label>
            <input
              id="plp-filter-price-min"
              type="number"
              name="minPrice"
              min={0}
              defaultValue={params.minPrice ?? ""}
              className={cn(CONTROL_CLASS, "w-28")}
            />
            <label htmlFor="plp-filter-price-max" className={LABEL_CLASS}>
              {t("filterPriceMax")}
            </label>
            <input
              id="plp-filter-price-max"
              type="number"
              name="maxPrice"
              min={0}
              defaultValue={params.maxPrice ?? ""}
              className={cn(CONTROL_CLASS, "w-28")}
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="plp-filter-sort" className={LABEL_CLASS}>
              {t("sortLabel")}
            </label>
            <AutoSubmitSelect
              id="plp-filter-sort"
              name="sort"
              defaultValue={params.sort}
              className={SELECT_CLASS}
            >
              <option value="newest">{t("sortOptions.newest")}</option>
              <option value="price-asc">{t("sortOptions.price-asc")}</option>
              <option value="price-desc">{t("sortOptions.price-desc")}</option>
              <option value="name-asc">{t("sortOptions.name-asc")}</option>
            </AutoSubmitSelect>
          </div>

          <button
            type="submit"
            className={buttonClassName({ variant: "outline-solid", size: "sm" })}
          >
            {t("apply")}
          </button>

          {hasListingFilters(params) && (
            <Link
              href={clearHref}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t("clearFilters")}
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
