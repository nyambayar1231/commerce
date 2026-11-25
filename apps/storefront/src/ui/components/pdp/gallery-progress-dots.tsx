// Adapted from saleor-storefront: src/ui/components/shared/gallery-progress-dots.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { cn } from "@/lib/utils";

interface GalleryProgressDotsProps {
  count: number;
  activeIndex: number;
  onSelect?: (index: number) => void;
  /** Receives the one-based image number for the dot's accessible name. */
  getAriaLabel: (imageNumber: number) => string;
  className?: string;
}

/**
 * Pill-style gallery position indicators — the active dot expands horizontally.
 * The gallery's mobile dots and the fullscreen viewer's dots.
 */
export function GalleryProgressDots({
  count,
  activeIndex,
  onSelect,
  getAriaLabel,
  className,
}: GalleryProgressDotsProps) {
  if (count <= 1) return null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled row of related buttons is role="group" (WAI-ARIA); a fieldset is form semantics
    <div className={cn("flex items-center justify-center gap-1.5", className)} role="group">
      {Array.from({ length: count }).map((_, index) => {
        const isActive = activeIndex === index;

        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: the dots have no identity of their own
            key={index}
            type="button"
            onClick={onSelect ? () => onSelect(index) : undefined}
            disabled={!onSelect}
            aria-label={getAriaLabel(index + 1)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "h-2 rounded-full transition-all",
              isActive ? "w-5 bg-foreground" : "w-2 bg-border",
              onSelect && !isActive && "hover:bg-muted-foreground",
              !onSelect && "cursor-default",
            )}
          />
        );
      })}
    </div>
  );
}
