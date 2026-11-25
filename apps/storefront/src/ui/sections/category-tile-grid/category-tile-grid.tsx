// Adapted from saleor-storefront: src/ui/sections/category-tile-grid/category-tile-grid.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CategoryTileView } from "@/lib/content/types";
import { cn } from "@/lib/utils";

// Paper's category tile grid, without images (M4.4): each tile is a name over the cover
// gradient. The image branches, the contain fit and the column/aspect options are left out —
// this repo has one home usage, on a muted band like Paper's home. The `Section` band is
// inlined (no section primitives here).

/** The grid's column layout: 2 columns, 3 from 640px (Paper's `columns = 3`). */
const COLUMNS_CLASS = "sm:grid-cols-2 lg:grid-cols-3";

interface CategoryTileGridProps {
  heading?: string;
  tiles: CategoryTileView[];
  className?: string;
}

/** The home tile grid: top-level categories as name tiles linking to their pages. */
export function CategoryTileGrid({ heading, tiles, className }: CategoryTileGridProps) {
  const headingId = "category-tile-grid-heading";
  return (
    <section
      className={cn("bg-muted py-section-lg", className)}
      aria-labelledby={heading ? headingId : undefined}
    >
      <div className="container-content">
        {heading ? (
          <h2 id={headingId} className="mb-10 text-balance text-h2">
            {heading}
          </h2>
        ) : null}
        <ul className={cn("grid list-none gap-4 lg:gap-6", COLUMNS_CLASS)}>
          {tiles.map((tile) => (
            <li key={tile.slug}>
              <Link
                href={`/categories/${tile.slug}`}
                className="group relative block overflow-hidden rounded-card bg-secondary no-underline hover:no-underline aspect-[4/3]"
              >
                <div
                  className="absolute inset-0 bg-gradient-to-t from-foreground/75 via-foreground/15 to-transparent"
                  aria-hidden="true"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-6">
                  <h3 className="text-h3 text-background">{tile.name}</h3>
                  <ArrowRight
                    className="h-5 w-5 shrink-0 text-background transition-transform duration-base ease-standard motion-reduce:transition-none md:group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The tile grid island's placeholder: the same muted band with tiles of the same shape. */
export function CategoryTileGridSkeleton({
  tileCount = 6,
  className,
}: {
  tileCount?: number;
  className?: string;
}) {
  return (
    <section className={cn("bg-muted py-section-lg", className)} aria-hidden="true">
      <div className="container-content">
        <div className="mb-10 h-8 w-48 animate-pulse rounded bg-muted-foreground/10" />
        <ul className={cn("grid list-none gap-4 lg:gap-6", COLUMNS_CLASS)}>
          {Array.from({ length: tileCount }).map((_, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: identical static skeleton cells; the index is their only identity and the list never reorders.
              key={i}
              className="aspect-[4/3] animate-pulse rounded-card bg-muted-foreground/10"
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
