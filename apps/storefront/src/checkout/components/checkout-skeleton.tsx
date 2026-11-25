// Adapted from saleor-storefront: src/checkout/views/saleor-checkout/checkout-skeleton.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { CheckoutFrame } from "./checkout-frame";

const bar = "animate-pulse rounded bg-muted";

/** Placeholder for the checkout's data island: the two columns at about their real size. */
export function CheckoutSkeleton() {
  return (
    <CheckoutFrame
      summary={
        <div aria-hidden="true" className="space-y-4 p-6">
          <div className={`${bar} h-6 w-40`} />
          {[0, 1].map((row) => (
            <div key={row} className="flex gap-4">
              <div className={`${bar} h-20 w-16`} />
              <div className="flex-1 space-y-2">
                <div className={`${bar} h-4 w-3/4`} />
                <div className={`${bar} h-3 w-1/3`} />
              </div>
            </div>
          ))}
          <div className={`${bar} h-24 w-full`} />
        </div>
      }
    >
      <div aria-hidden="true" className="space-y-4">
        <div className={`${bar} h-8 w-48`} />
        <div className={`${bar} h-12 w-full`} />
        <div className={`${bar} h-12 w-full`} />
        <div className={`${bar} h-12 w-full`} />
      </div>
    </CheckoutFrame>
  );
}
