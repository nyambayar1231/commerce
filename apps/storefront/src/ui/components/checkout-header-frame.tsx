// Adapted from saleor-storefront: src/checkout/views/saleor-checkout/checkout-header.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Lock } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Checkout header frame: shop name and "secure checkout". The steps come with the checkout. */
export function CheckoutHeaderFrame({ shopName }: { shopName: ReactNode }) {
  const t = useTranslations();

  return (
    <header className="bg-background md:border-b md:border-border">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 md:pb-4 md:pt-4 lg:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center text-xl font-semibold text-foreground">
            {shopName}
          </Link>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span className="text-xs">{t("checkout.secureCheckout")}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
