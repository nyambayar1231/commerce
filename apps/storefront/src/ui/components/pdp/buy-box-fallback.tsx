// Adapted from saleor-storefront: src/ui/components/pdp/variant-selection/variant-section-fallback.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ShoppingBag } from "lucide-react";
import { buttonClassName } from "@/ui/components/ui/button";

interface BuyBoxFallbackProps {
  /** The no-selection price (the range), from data the parent island already resolved. */
  price: string;
  selectVariantLabel: string;
  secureCheckoutLabel: string;
}

/**
 * The buy box island's Suspense fallback, rendered from data the parent island already has:
 * the price range and the disabled "choose a variant" button, so the streamed buy box does not
 * read as a stall. A server component — it must not import the client button.
 */
export function BuyBoxFallback({
  price,
  selectVariantLabel,
  secureCheckoutLabel,
}: BuyBoxFallbackProps) {
  return (
    <div className="order-3 mt-4 space-y-6" aria-busy="true">
      <div className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{price}</span>
        </div>
        <button
          type="button"
          disabled
          className={buttonClassName({
            size: "lg",
            className: "h-14 w-full text-base font-medium",
          })}
        >
          <ShoppingBag className="mr-2 h-5 w-5" />
          {selectVariantLabel}
        </button>
        <div className="flex items-center justify-center gap-6 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {secureCheckoutLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
