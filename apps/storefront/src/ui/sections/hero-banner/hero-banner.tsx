// Adapted from saleor-storefront: src/ui/sections/hero-banner/hero-banner.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonClassName } from "@/ui/components/ui/button";

// Paper's hero banner, text-only (M4.4): the owner has no hero image yet, so the image branch,
// its scrim and the secondary CTA are left out; the text comes from `messages` and the button
// links to `/products` (a plain `<Link>`, not Paper's `NavHrefLink`, which exists for channel
// prefixes we don't have).

export type HeroBannerHeight = "compact" | "default" | "large";

export interface HeroBannerCta {
  label: string;
  href: string;
}

export interface HeroBannerProps {
  heading: string;
  subheading?: string;
  primaryCta?: HeroBannerCta;
  height?: HeroBannerHeight;
  className?: string;
}

const heightClassName: Record<HeroBannerHeight, string> = {
  compact: "min-h-[280px] md:min-h-[320px]",
  default: "min-h-[360px] md:min-h-[420px]",
  large: "min-h-[420px] md:min-h-[520px]",
};

/** The hero: heading, subheading and one CTA, bottom-aligned in a bordered band. */
export function HeroBanner({
  heading,
  subheading,
  primaryCta,
  height = "default",
  className,
}: HeroBannerProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-border",
        heightClassName[height],
        className,
      )}
      aria-labelledby="homepage-hero-heading"
    >
      <div className="container-content relative flex h-full min-h-[inherit] flex-col justify-end pb-10 pt-16 sm:pb-12">
        <div className="max-w-2xl">
          <h1 id="homepage-hero-heading" className="text-balance text-display text-foreground">
            {heading}
          </h1>
          {subheading ? (
            <p className="mt-5 text-pretty text-lead text-muted-foreground md:mt-6">{subheading}</p>
          ) : null}
          {primaryCta ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={primaryCta.href}
                className={buttonClassName({ asLink: true, size: "lg" })}
              >
                {primaryCta.label}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** The hero island's placeholder: the same band with the heading, lead and button pulsing. */
export function HeroBannerSkeleton({ height = "default" }: { height?: HeroBannerHeight }) {
  return (
    <section
      aria-hidden="true"
      className={cn("border-b border-border bg-muted", heightClassName[height])}
    >
      <div className="container-content relative flex h-full min-h-[inherit] flex-col justify-end pb-10 pt-16 sm:pb-12">
        <div className="max-w-2xl">
          <div className="h-10 w-2/3 max-w-xl animate-pulse rounded bg-muted-foreground/10" />
          <div className="mt-5 h-5 w-1/2 max-w-md animate-pulse rounded bg-muted-foreground/10" />
          <div className="mt-8 h-14 w-36 animate-pulse rounded-button bg-muted-foreground/10" />
        </div>
      </div>
    </section>
  );
}
