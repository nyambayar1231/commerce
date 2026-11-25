// Adapted from saleor-storefront: src/ui/components/pdp/product-gallery.tsx and src/ui/components/ui/image-carousel.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { ProductViewImage } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/ui/atoms/product-image";
import { Button } from "@/ui/components/ui/button";
import {
  galleryImageFrameClass,
  PDP_GALLERY_EMPTY_IMAGE_FRAME_CLASS,
  PDP_GALLERY_IMAGE_CLIP_CLASS,
  PDP_GALLERY_IMAGE_FOCUS_CLASS,
  PDP_GALLERY_IMAGE_FOCUS_OVERLAY_CLASS,
  PDP_GALLERY_IMAGE_ZOOM_TRIGGER_CLASS,
} from "./gallery-image-frame";
import {
  PDP_MAIN_IMAGE_HEIGHT,
  PDP_MAIN_IMAGE_SIZES,
  PDP_MAIN_IMAGE_WIDTH,
  PDP_THUMB_IMAGE_SIZE,
} from "./gallery-layout";
import { GalleryProgressDots } from "./gallery-progress-dots";
import { ProductImageViewer } from "./product-image-viewer";
import { useProductImageViewer } from "./use-product-image-viewer";

interface ProductGalleryProps {
  images: ProductViewImage[];
  productName: string;
}

/**
 * The PDP's gallery: a main stage with the thumbnail strip beside it on desktop, progress
 * dots below it on mobile, and hover arrows on the stage. Tapping the stage opens the
 * fullscreen viewer (keyboard: the stage is a button, so Enter opens it too). The first image
 * is the page's LCP rung — eager, high fetch priority; the rest are lazy.
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const t = useTranslations("pdp");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // A variant switch reorders the images; the gallery then starts again at the first one.
  const imagesKey = images.map((image) => image.src).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: imagesKey is an intentional reset trigger (Paper's pattern), not a value the effect reads
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [imagesKey]);

  const { viewerIndex, isViewerOpen, openViewer, onViewerOpenChange } =
    useProductImageViewer(imagesKey);

  if (images.length === 0) {
    return (
      <div className={PDP_GALLERY_EMPTY_IMAGE_FRAME_CLASS}>
        <span className="text-muted-foreground">{t("noImage")}</span>
      </div>
    );
  }

  const index = Math.min(selectedIndex, images.length - 1);
  const image = images[index];
  if (image === undefined) throw new Error("No image at the selected index");
  const hasMultiple = images.length > 1;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {hasMultiple ? (
          // The thumbnail column, beside the stage on desktop; mobile shows dots instead.
          <div className="hidden max-h-[40rem] gap-2 overflow-y-auto px-1 py-1 [scrollbar-width:none] md:flex md:flex-col">
            {images.map((thumb, thumbIndex) => (
              <button
                key={thumb.id}
                type="button"
                onClick={() => setSelectedIndex(thumbIndex)}
                aria-label={t("gallery.goToImage", { index: thumbIndex + 1 })}
                aria-current={index === thumbIndex ? "true" : undefined}
                className={cn(
                  "relative h-20 w-20 shrink-0 rounded-md",
                  PDP_GALLERY_IMAGE_FOCUS_CLASS,
                  index === thumbIndex ? "opacity-100" : "opacity-60 hover:opacity-100",
                )}
              >
                <span className={cn(PDP_GALLERY_IMAGE_CLIP_CLASS, "rounded-md")}>
                  {/* biome-ignore lint/performance/noImgElement: the API's stored 128 WebP thumbnail, shown at 80px — no optimizer (ARCHITECTURE §10.12). */}
                  <img
                    src={thumb.thumb}
                    alt=""
                    width={PDP_THUMB_IMAGE_SIZE}
                    height={PDP_THUMB_IMAGE_SIZE}
                    loading="lazy"
                    draggable={false}
                    className="object-cover"
                  />
                </span>
                <span
                  className={cn(
                    PDP_GALLERY_IMAGE_FOCUS_OVERLAY_CLASS,
                    "rounded-md",
                    index === thumbIndex && "ring-2 ring-foreground",
                  )}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className={galleryImageFrameClass("group aspect-[4/5] w-full")}>
            <button
              type="button"
              onClick={() => openViewer(index)}
              aria-label={t("gallery.viewImage", { name: image.alt, index: index + 1 })}
              className={PDP_GALLERY_IMAGE_ZOOM_TRIGGER_CLASS}
            >
              <span className={PDP_GALLERY_IMAGE_CLIP_CLASS}>
                <ProductImage
                  image={{ src: image.src, srcSet: image.srcSet, alt: image.alt }}
                  sizes={PDP_MAIN_IMAGE_SIZES}
                  width={PDP_MAIN_IMAGE_WIDTH}
                  height={PDP_MAIN_IMAGE_HEIGHT}
                  priority={index === 0}
                />
              </span>
              <span className={PDP_GALLERY_IMAGE_FOCUS_OVERLAY_CLASS} aria-hidden="true" />
            </button>

            {/* Navigation arrows — hidden on mobile, revealed on desktop hover. */}
            {hasMultiple && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedIndex((current) => Math.max(current - 1, 0))}
                  disabled={index === 0}
                  aria-label={t("gallery.previousImage")}
                  className={cn(
                    "absolute left-4 top-1/2 z-10 -translate-y-1/2 border border-border bg-background opacity-0 shadow-none transition-opacity hover:bg-accent group-hover:opacity-100",
                    "hidden disabled:opacity-0 md:flex",
                  )}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSelectedIndex((current) => Math.min(current + 1, images.length - 1))
                  }
                  disabled={index === images.length - 1}
                  aria-label={t("gallery.nextImage")}
                  className={cn(
                    "absolute right-4 top-1/2 z-10 -translate-y-1/2 border border-border bg-background opacity-0 shadow-none transition-opacity hover:bg-accent group-hover:opacity-100",
                    "hidden disabled:opacity-0 md:flex",
                  )}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>

          {hasMultiple && (
            <GalleryProgressDots
              count={images.length}
              activeIndex={index}
              onSelect={setSelectedIndex}
              getAriaLabel={(imageNumber) => t("gallery.goToImage", { index: imageNumber })}
              className="mt-4 md:hidden"
            />
          )}
        </div>
      </div>

      <ProductImageViewer
        images={images}
        productName={productName}
        initialIndex={viewerIndex ?? 0}
        open={isViewerOpen}
        onOpenChange={onViewerOpenChange}
      />
    </>
  );
}
