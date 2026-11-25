// Adapted from saleor-storefront: src/ui/components/pdp/non-matrix-buy-box.tsx and src/ui/components/pdp/variant-selection/variant-name-selector.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { VariantView } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

interface NonMatrixBuyBoxProps {
  variants: VariantView[];
  selectedVariantId: string | null;
  productSlug: string;
}

/**
 * The non-matrix buy box: a product with several variants and no attribute matrix, so a list
 * is the honest picker. Each variant is a radio-style link that replaces the URL without
 * scrolling (`?variant=<id>`); sold-out variants are shown, marked with a strike-through.
 * A single-variant product has nothing to choose and renders nothing.
 */
export function NonMatrixBuyBox({
  variants,
  selectedVariantId,
  productSlug,
}: NonMatrixBuyBoxProps) {
  const t = useTranslations("pdp");

  if (variants.length <= 1) return null;

  const pricesVary = new Set(variants.map((variant) => variant.price)).size > 1;

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">{t("variantsLabel")}</span>
      <div role="radiogroup" aria-label={t("variantsLabel")} className="flex flex-wrap gap-3">
        {variants.map((variant) => {
          const selected = variant.id === selectedVariantId;
          const soldOut = variant.stock === "outOfStock";
          // The accessible name carries what the visual pill shows: the variant, its price
          // when they differ, and its sold-out state.
          const accessibleName = [
            variant.name,
            pricesVary ? variant.price : null,
            soldOut ? t("outOfStock") : null,
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <Link
              key={variant.id}
              href={`/products/${productSlug}?variant=${variant.id}`}
              replace
              scroll={false}
              role="radio"
              aria-checked={selected}
              aria-current={selected ? "true" : undefined}
              aria-label={accessibleName}
              className={cn(
                "inline-flex h-12 min-w-[4.5rem] items-center justify-center rounded-lg border px-4 text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:border-foreground",
                soldOut && "text-muted-foreground line-through opacity-60",
              )}
            >
              <span className="flex items-center gap-2">
                {variant.name}
                {pricesVary && (
                  <span
                    className={cn("text-xs", selected ? "opacity-80" : "text-muted-foreground")}
                  >
                    {variant.price}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
