// Adapted from saleor-storefront: src/checkout/views/empty-cart-page/empty-cart-page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ShoppingBag, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/ui/components/ui/button";

/** The checkout without a cart to pay for (`empty`), or one the API could not be asked about. */
export function CheckoutMessage({ kind }: { kind: "empty" | "unavailable" }) {
  const t = useTranslations(kind === "empty" ? "checkout.empty" : "checkout.unavailable");
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <ShoppingCart className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mb-8 text-muted-foreground">{t("body")}</p>
        <Link
          href={kind === "empty" ? "/products" : "/"}
          className={buttonClassName({ asLink: true, size: "lg", className: "h-12 w-full" })}
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          {t("action")}
        </Link>
      </div>
    </div>
  );
}
