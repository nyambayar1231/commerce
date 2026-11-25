// Adapted from saleor-storefront: src/ui/sections/featured-collection-section/featured-collection-section.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ProductCardView } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { ProductGrid } from "@/ui/components/plp/product-grid";

// Paper's featured collection section with `Section`/`SectionHeader` inlined (no section
// primitives in this repo) and without the empty state — the page hides the whole section when
// the collection is missing or empty, so this component always has products to show.

interface FeaturedCollectionSectionProps {
  /** The collection's name, shown as the section's eyebrow. */
  name: string;
  items: ProductCardView[];
  /** The "view all" link's target: the collection page. */
  viewAllHref: string;
  className?: string;
}

/** The home page's featured collection: a heading, a "view all" link and the product grid. */
export function FeaturedCollectionSection({
  name,
  items,
  viewAllHref,
  className,
}: FeaturedCollectionSectionProps) {
  const t = useTranslations("home");
  const headingId = "featured-collection-heading";

  return (
    <section className={cn("bg-background py-section-lg", className)} aria-labelledby={headingId}>
      <div className="container-content">
        <div className="flex flex-col gap-y-4 sm:flex-row sm:items-end sm:justify-between sm:gap-x-8">
          <div>
            <p className="text-eyebrow uppercase text-muted-foreground">{name}</p>
            <h2 id={headingId} className="mt-3 text-balance text-h2">
              {t("featuredTitle")}
            </h2>
          </div>
          <Link
            href={viewAllHref}
            className="shrink-0 text-sm font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80"
          >
            {t("featuredViewAll")}
          </Link>
        </div>
        <div className="mt-10">
          <ProductGrid items={items} />
        </div>
      </div>
    </section>
  );
}
