// Adapted from saleor-storefront: src/ui/components/shared/gallery-image-frame.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

/**
 * Canonical PDP image tile surface — shared by the gallery, its fallback and the skeleton.
 *
 * `isolate` + `overflow-hidden` + matching `rounded-lg` prevents image layers from bleeding or
 * clipping at mismatched radii.
 *
 * For tap-to-zoom controls, compose the zoom trigger classes below — never put `overflow-hidden`
 * on the same element that receives focus rings.
 */
export const PDP_GALLERY_IMAGE_FRAME_CLASS =
  "relative isolate overflow-hidden rounded-lg bg-secondary";

/**
 * Inner clip layer for zoom triggers — inherits the trigger's border radius and holds the image
 * so its corners are clipped. `pointer-events-none` keeps clicks on the button itself.
 */
export const PDP_GALLERY_IMAGE_CLIP_CLASS =
  "pointer-events-none absolute inset-0 isolate overflow-hidden rounded-[inherit] bg-secondary";

/**
 * Focus indicator drawn as an inset overlay ON TOP of the image. Inset rings live inside the
 * element box, so an ancestor `overflow:hidden` viewport can never clip them.
 */
export const PDP_GALLERY_IMAGE_FOCUS_OVERLAY_CLASS =
  "pointer-events-none absolute inset-0 rounded-[inherit] ring-inset ring-ring transition-[box-shadow] group-focus-visible:ring-2";

/** Marks the focusable shell as a group and removes the default outline. */
export const PDP_GALLERY_IMAGE_FOCUS_CLASS = "group focus-visible:outline-none";

/** Outer tap-to-zoom `<button>` shell — rounded, no overflow clip (the ring is an inset overlay). */
export const PDP_GALLERY_IMAGE_ZOOM_TRIGGER_CLASS = cn(
  "relative block h-full min-h-0 w-full cursor-zoom-in rounded-lg",
  PDP_GALLERY_IMAGE_FOCUS_CLASS,
);

export function galleryImageFrameClass(...mix: ClassValue[]) {
  return cn(PDP_GALLERY_IMAGE_FRAME_CLASS, ...mix);
}

/** Empty-state hero tile (the gallery's no-image block). */
export const PDP_GALLERY_EMPTY_IMAGE_FRAME_CLASS = galleryImageFrameClass(
  "flex aspect-[4/5] w-full items-center justify-center",
);

interface GalleryImageFrameProps extends React.ComponentProps<"div"> {
  className?: string;
}

export function GalleryImageFrame({ className, children, ...props }: GalleryImageFrameProps) {
  return (
    <div className={galleryImageFrameClass(className)} {...props}>
      {children}
    </div>
  );
}
