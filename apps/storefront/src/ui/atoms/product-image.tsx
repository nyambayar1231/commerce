// Adapted from saleor-storefront: src/ui/atoms/saleor-image.tsx and src/ui/atoms/product-image-wrapper.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ProductCardImage } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  image: ProductCardImage | null;
  sizes: string;
  /** The intrinsic dimensions the element declares: the box it fills (3:4 on cards). */
  width: number;
  height: number;
  /** The page's LCP rung: eager loading and high fetch priority. The first four cards set it. */
  priority?: boolean;
  className?: string;
}

/**
 * A catalog image from the API's stored WebP thumbnails — a plain `<img srcset sizes>`, never
 * the Next.js optimizer (ARCHITECTURE §10.12: the API already made and stored each size, so
 * optimizing would re-encode an optimal file). Explicit dimensions keep the layout stable; a
 * neutral placeholder block renders when there is no image.
 */
export function ProductImage({
  image,
  sizes,
  width,
  height,
  priority = false,
  className,
}: ProductImageProps) {
  if (image === null) {
    return <div aria-hidden="true" className={cn("h-full w-full bg-secondary", className)} />;
  }

  return (
    // biome-ignore lint/performance/noImgElement: the API already made and stored this WebP at the requested sizes (ARCHITECTURE §10.12); the Next.js optimizer would only re-encode it.
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={image.alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
