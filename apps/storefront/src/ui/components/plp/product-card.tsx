// Adapted from saleor-storefront: src/ui/components/plp/{product-card,product-card-base}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type { AddToCartAction } from "@/lib/cart/types";
import type { ProductCardView } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/ui/atoms/product-image";
import { ProductCardLink } from "./product-card-link";
import { QuickAddButton } from "./quick-add-button";

/** The card grid's `sizes`: 4 columns ≥1024px, 3 ≥640px, 2 below. */
export const PLP_IMAGE_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/** The image box is a fixed 3:4 (the declared intrinsic dimensions match it). */
const CARD_IMAGE_WIDTH = 256;
const CARD_IMAGE_HEIGHT = Math.round((256 * 4) / 3);

interface ProductCardProps {
  product: ProductCardView;
  /** Eager, high-priority image: the first four cards of a page (the LCP rung). */
  priority?: boolean;
  imageSizes?: string;
  /** The `addToCart` Server Action; with it, a card whose product has a quick-add variant shows the button. */
  addAction?: AddToCartAction;
}

/**
 * One grid cell, adapted from Paper's card: the image is a link (hidden from assistive tech and
 * the tab order, the text link below is the one that counts), then a text link whose accessible
 * name is the product name, price and availability as text — never colour alone. Sold-out
 * products are shown. The quick-add button sits over the image, outside both links.
 */
export function ProductCard({
  product,
  priority = false,
  imageSizes = PLP_IMAGE_SIZES,
  addAction,
}: ProductCardProps) {
  const t = useTranslations("plp");

  return (
    <article className="group">
      <div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-card bg-secondary">
        <ProductCardLink
          href={product.href}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 z-0 block"
        >
          <ProductImage
            image={product.image}
            sizes={imageSizes}
            width={CARD_IMAGE_WIDTH}
            height={CARD_IMAGE_HEIGHT}
            priority={priority}
            className="transition-all duration-500 ease-out md:group-hover:scale-105"
          />
        </ProductCardLink>
        {addAction !== undefined && product.quickAddVariantId !== null && (
          <QuickAddButton
            variantId={product.quickAddVariantId}
            productName={product.name}
            addAction={addAction}
          />
        )}
      </div>

      <ProductCardLink
        href={product.href}
        aria-label={product.name}
        className="block no-underline hover:no-underline"
      >
        <div className="space-y-1.5">
          {product.categoryName !== null && (
            <p className="text-eyebrow uppercase text-muted-foreground">{product.categoryName}</p>
          )}
          <h3
            className="truncate font-medium leading-snug text-foreground/80 no-underline transition-colors duration-200 md:group-hover:text-foreground"
            title={product.name}
          >
            {product.name}
          </h3>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5">
            {product.price !== null && (
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  product.soldOut && "text-muted-foreground",
                )}
              >
                {product.priceFrom ? t("priceFrom", { price: product.price }) : product.price}
              </span>
            )}
            {product.soldOut && (
              <span className="text-sm text-muted-foreground">{t("soldOut")}</span>
            )}
          </div>
        </div>
      </ProductCardLink>
    </article>
  );
}
