// Adapted from saleor-storefront: src/checkout/views/saleor-checkout/saleor-checkout.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ReactNode } from "react";

/** Two columns: the step on the left, the order summary on the right (below it on a phone). */
export function CheckoutFrame({ children, summary }: { children: ReactNode; summary: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="min-w-0 flex-1">
          <div className="rounded-lg border border-border bg-card p-6 md:p-8">{children}</div>
        </div>
        <aside className="md:shrink-0 md:basis-[30%]">
          <div className="overflow-hidden rounded-lg border border-border bg-card md:sticky md:top-8">
            {summary}
          </div>
        </aside>
      </div>
    </div>
  );
}
