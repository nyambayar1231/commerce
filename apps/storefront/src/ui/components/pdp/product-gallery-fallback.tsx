// Adapted from saleor-storefront: src/ui/components/pdp/product-gallery-fallback.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type { ProductViewImage } from "@/lib/catalog/types";
import { ProductImage } from "@/ui/atoms/product-image";
import { GalleryImageFrame, PDP_GALLERY_EMPTY_IMAGE_FRAME_CLASS } from "./gallery-image-frame";
import {
  PDP_MAIN_IMAGE_HEIGHT,
  PDP_MAIN_IMAGE_SIZES,
  PDP_MAIN_IMAGE_WIDTH,
} from "./gallery-layout";
import { ProductGalleryShell } from "./product-gallery-shell";

interface ProductGalleryFallbackProps {
  /** The first image in default order: the page's LCP rung, eager and high-priority. */
  image: ProductViewImage | null;
  /** The default image count; chrome (dots, thumbnails) is reserved when it is above one. */
  imageCount: number;
}

/**
 * The gallery island's Suspense fallback: the first image in the same chrome the streamed
 * gallery will use, so the LCP paints before `?variant=` resolves and the swap causes no
 * layout shift.
 */
export function ProductGalleryFallback({ image, imageCount }: ProductGalleryFallbackProps) {
  const t = useTranslations("pdp");

  return (
    <ProductGalleryShell imageCount={imageCount}>
      {image === null ? (
        <div className={PDP_GALLERY_EMPTY_IMAGE_FRAME_CLASS}>
          <span className="text-muted-foreground">{t("noImage")}</span>
        </div>
      ) : (
        <GalleryImageFrame className="aspect-[4/5] w-full">
          <ProductImage
            image={{ src: image.src, srcSet: image.srcSet, alt: image.alt }}
            sizes={PDP_MAIN_IMAGE_SIZES}
            width={PDP_MAIN_IMAGE_WIDTH}
            height={PDP_MAIN_IMAGE_HEIGHT}
            priority
          />
        </GalleryImageFrame>
      )}
    </ProductGalleryShell>
  );
}
