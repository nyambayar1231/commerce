// Adapted from saleor-storefront: src/ui/components/plp/category-hero.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ReactNode } from "react";
import { WavePattern } from "./wave-pattern";

interface CategoryHeroProps {
  title: string;
  /** The meta line under the title: the product count and, on category pages, child links. */
  children?: ReactNode;
}

/**
 * The listing pages' hero: the wave background band with the title bottom-aligned. Our API has
 * no hero background images or published descriptions yet (M4.2), so Paper's image branch is
 * omitted and the meta line is passed as children.
 */
export function CategoryHero({ title, children }: CategoryHeroProps) {
  return (
    <section className="relative h-[340px] overflow-hidden border-b border-border">
      <div className="absolute inset-0">
        <WavePattern className="h-full w-full" />
      </div>

      <div className="container-content relative flex h-full flex-col justify-end pb-10">
        <h1 className="text-balance text-h1 text-foreground">{title}</h1>
        {children !== undefined && <div className="mt-5">{children}</div>}
      </div>
    </section>
  );
}
