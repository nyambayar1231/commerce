// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/cart/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";

/** The cart page's loading state: the title and two line-shaped placeholders. */
export function CartPageSkeleton() {
  const t = useTranslations("cart");
  return (
    <>
      <h1 className="mt-8 text-balance text-h1 text-foreground">{t("title")}</h1>
      <div aria-hidden="true" className="mt-12 animate-pulse">
        <div className="divide-y divide-border border-y border-border">
          {[1, 2].map((row) => (
            <div key={row} className="flex gap-4 py-4">
              <div className="h-32 w-24 rounded-lg bg-muted sm:h-40 sm:w-32" />
              <div className="flex-1 py-2">
                <div className="h-5 w-48 rounded bg-muted" />
                <div className="mt-2 h-4 w-32 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 h-20 rounded-md bg-muted" />
      </div>
    </>
  );
}
