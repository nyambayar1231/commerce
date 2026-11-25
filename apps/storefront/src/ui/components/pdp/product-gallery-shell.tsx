// Adapted from saleor-storefront: src/ui/components/pdp/product-gallery-shell.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ProductGalleryShellProps {
  /** Total images — used for the thumbnail and dot placeholders when chrome is shown. */
  imageCount: number;
  children: ReactNode;
}

/**
 * The gallery's chrome layout: the main stage, with the thumbnail strip beside it on desktop
 * and the progress dots below it on mobile. Used by the Suspense fallback and the skeleton so
 * the streamed gallery does not shift layout. Chrome shows only with more than one image.
 */
export function ProductGalleryShell({ imageCount, children }: ProductGalleryShellProps) {
  const showChrome = imageCount > 1;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {showChrome ? (
        // The thumbnail column beside the stage on desktop; hidden on mobile (dots instead).
        <div
          className="hidden max-h-[40rem] gap-2 overflow-y-auto px-1 py-1 [scrollbar-width:none] md:flex md:flex-col"
          aria-hidden="true"
        >
          {Array.from({ length: imageCount }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity of their own
              key={index}
              className={cn(
                "relative isolate h-20 w-20 shrink-0 overflow-hidden rounded-md bg-secondary",
                index === 0
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : "opacity-60",
              )}
            />
          ))}
        </div>
      ) : null}
      <div className="w-full min-w-0 flex-1">
        {children}
        {showChrome ? (
          <div className="mt-4 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
            {Array.from({ length: imageCount }).map((_, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity of their own
                key={index}
                className={cn("h-2 w-2 rounded-full", index === 0 ? "bg-foreground" : "bg-border")}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
