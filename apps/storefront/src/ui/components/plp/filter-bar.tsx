// Adapted from saleor-storefront: src/ui/components/plp/filter-bar.tsx and the category, price and
// sort parts of use-product-filters.ts (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { FilterBarView, ListingParams, PriceRangeText } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { buttonClassName } from "@/ui/components/ui/button";
import { CountBadge, type FilterChoice, FilterChoiceList, FilterPill } from "./filter-pill";

interface FilterBarProps {
  /** Every option, with its URL built by `buildFilterBarView`. */
  view: FilterBarView;
  /** `true` when any filter (not the sort) is set. */
  filtered: boolean;
  /** A URL that clears the filters but keeps the sort, built by the page island. */
  clearHref: string;
  /** The products matching the filters; `null` when the API gave no count. */
  totalCount: number | null;
}

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
 * The listing's filter bar as Paper's pills (Ангилал, Коллекц, Үнэ), the product count and a sort
 * pill; on phones one "Шүүлтүүр" button opens a sheet with every filter. A server component
 * with no client JavaScript: pills and the sheet are native `popover`s, every option is a `<Link>`
 * to the listing URL with that one parameter changed (cursors dropped), so a choice applies at once.
 * The bar is keyed by the URL so a navigation remounts it and the open panel closes.
 */
export function FilterBar({ view, filtered, clearHref, totalCount }: FilterBarProps) {
  const t = useTranslations("plp");

  const priceLabel = (range: PriceRangeText): string => {
    if (range.min !== undefined && range.max !== undefined) {
      return t("priceBetween", { min: range.min, max: range.max });
    }
    if (range.max !== undefined) return t("priceUpTo", { max: range.max });
    if (range.min !== undefined) return t("priceFromUp", { min: range.min });
    return t("allPrices");
  };

  const groups = view.groups.map((group) => {
    const name = t(
      group.id === "category"
        ? "filterCategory"
        : group.id === "collection"
          ? "filterCollection"
          : "filterPrice",
    );
    const allLabel = t(
      group.id === "category"
        ? "allCategories"
        : group.id === "collection"
          ? "allCollections"
          : "allPrices",
    );
    const choices: FilterChoice[] = group.choices.map((choice) => ({
      key: choice.key,
      label:
        choice.kind === "all"
          ? allLabel
          : choice.kind === "price"
            ? priceLabel(choice.price ?? {})
            : (choice.label ?? ""),
      href: choice.href,
      selected: choice.selected,
      ...(choice.level !== undefined ? { level: choice.level } : {}),
    }));
    return {
      id: `plp-filter-${group.id}`,
      // A hand-typed price still filters; its pill then shows the range.
      label: group.customPrice ? priceLabel(group.customPrice) : name,
      heading: name,
      count: group.count,
      choices,
    };
  });

  const sortChoices: FilterChoice[] = view.sortChoices.map((choice) => ({
    key: choice.sort,
    label: t(`sortOptions.${choice.sort}`),
    href: choice.href,
    selected: choice.selected,
  }));

  const activeCount = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <div key={view.key} className="sticky top-16 z-30 border-b border-border bg-background">
      <nav aria-label={t("filters")} className="container-content py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* Phones: one button, the sheet lists every filter. */}
            <button
              type="button"
              popoverTarget="plp-filter-sheet"
              className={buttonClassName({
                variant: "outline-solid",
                size: "sm",
                className: "shrink-0 bg-transparent lg:hidden",
              })}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {t("filters")}
              {activeCount > 0 && <CountBadge count={activeCount} />}
            </button>

            {/* Desktop: one pill per filter. */}
            {groups.map((group) => (
              <FilterPill
                key={group.id}
                id={group.id}
                label={group.label}
                count={group.count}
                heading={group.heading}
                choices={group.choices}
                className="hidden lg:block"
              />
            ))}

            {filtered && (
              <Link
                href={clearHref}
                className="hidden whitespace-nowrap px-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground lg:inline"
              >
                {t("clearFilters")}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {totalCount !== null && (
              <p className="hidden whitespace-nowrap text-sm text-muted-foreground sm:block">
                {t("productCount", { count: totalCount })}
              </p>
            )}
            <FilterPill
              id="plp-filter-sort"
              label={t("sortLabel")}
              count={0}
              heading={t("sortLabel")}
              choices={sortChoices}
              className="shrink-0"
            />
          </div>
        </div>
      </nav>

      <div
        id="plp-filter-sheet"
        popover="auto"
        role="dialog"
        aria-label={t("filters")}
        className={cn(
          "m-0 h-dvh max-h-none w-[280px] max-w-[85vw] flex-col border-0 bg-background p-0 text-foreground shadow-lg",
          "[inset:0_auto_0_0] backdrop:bg-black/50 open:flex lg:hidden",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-lg font-semibold">{t("filters")}</h2>
          <button
            type="button"
            popoverTarget="plp-filter-sheet"
            popoverTargetAction="hide"
            aria-label={t("closeFilters")}
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 divide-y divide-border overflow-y-auto">
          {groups.map((group) => (
            <section key={group.id} className="px-2 py-4">
              <h3 className="mb-2 px-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {group.heading}
              </h3>
              <FilterChoiceList choices={group.choices} />
            </section>
          ))}
        </div>
        {filtered && (
          <div className="border-t border-border p-4">
            <Link
              href={clearHref}
              className={buttonClassName({ variant: "outline-solid", className: "w-full" })}
            >
              {t("clearFilters")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
