// Adapted from saleor-storefront: src/ui/components/pdp/product-image-viewer.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { ProductViewImage } from "@/lib/catalog/types";
import { Button } from "@/ui/components/ui/button";
import { GalleryProgressDots } from "./gallery-progress-dots";

interface ProductImageViewerProps {
  images: ProductViewImage[];
  productName: string;
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The fullscreen image viewer, as a native `<dialog>` opened with `showModal()`: the browser
 * traps focus inside it, Escape fires `cancel` and closes it, and focus returns to the trigger
 * on close. No dialog library (Paper's is Radix + react-zoom-pan-pinch, both out of scope).
 * The image is the 2048 rung (§10.12).
 */
export function ProductImageViewer({
  images,
  productName,
  initialIndex,
  open,
  onOpenChange,
}: ProductImageViewerProps) {
  const t = useTranslations("pdp");
  const [index, setIndex] = React.useState(initialIndex);
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  const image = images[Math.min(index, images.length - 1)];
  const hasMultiple = images.length > 1;

  React.useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  // The modal is opened imperatively: only showModal() gives the focus trap, the top layer and
  // the Escape-to-close behaviour. Guarded so environments without `<dialog>` support (jsdom)
  // still render the content.
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && typeof dialog.showModal === "function") dialog.showModal();
  }, [open]);

  const close = React.useCallback(() => {
    // Close the element first, so the browser restores focus to the trigger before it unmounts.
    if (typeof dialogRef.current?.close === "function") dialogRef.current.close();
    onOpenChange(false);
  }, [onOpenChange]);

  const goToPrevious = React.useCallback(() => {
    setIndex((current) => (current > 0 ? current - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = React.useCallback(() => {
    setIndex((current) => (current < images.length - 1 ? current + 1 : 0));
  }, [images.length]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevious();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, goToPrevious, goToNext]);

  if (!open || image === undefined) return null;

  const alt = t("viewer.imageAlt", { name: productName, index: index + 1 });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a native <dialog> closes on Escape by itself; only its backdrop is click-to-close
    <dialog
      ref={dialogRef}
      aria-label={t("viewer.title", { name: productName })}
      onCancel={close}
      // The backdrop is the dialog element itself; a click that hit nothing else closes.
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
      className="m-0 h-[100dvh] w-screen max-w-none overflow-hidden bg-background p-0 text-foreground"
    >
      <div className="relative isolate flex h-full w-full flex-col overflow-hidden bg-background">
        <header className="relative z-20 flex shrink-0 items-center justify-end px-4 pb-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label={t("viewer.close")}
            className="text-foreground hover:bg-accent"
          >
            <X className="h-6 w-6" />
          </Button>
        </header>

        <div className="relative min-h-0 flex-1">
          {/* biome-ignore lint/performance/noImgElement: the viewer shows the API's stored 2048 WebP directly (ARCHITECTURE §10.12); the Next.js optimizer would only re-encode it. */}
          <img
            src={image.large}
            alt={alt}
            draggable={false}
            loading="lazy"
            className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
          />

          {hasMultiple && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
              <Button
                type="button"
                variant="outline-solid"
                size="icon"
                onClick={goToPrevious}
                aria-label={t("viewer.previousImage")}
                className="pointer-events-auto rounded-full bg-background/90 shadow-none"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="outline-solid"
                size="icon"
                onClick={goToNext}
                aria-label={t("viewer.nextImage")}
                className="pointer-events-auto rounded-full bg-background/90 shadow-none"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {hasMultiple && (
          <footer className="relative z-20 flex shrink-0 flex-col items-center gap-2 px-4 pb-5 pt-3">
            <GalleryProgressDots
              count={images.length}
              activeIndex={index}
              onSelect={setIndex}
              getAriaLabel={(imageNumber) =>
                t("viewer.imageAlt", { name: productName, index: imageNumber })
              }
              className="text-foreground"
            />
            <span className="sr-only" aria-live="polite">
              {t("viewer.counter", { current: index + 1, total: images.length })}
            </span>
          </footer>
        )}
      </div>
    </dialog>
  );
}
