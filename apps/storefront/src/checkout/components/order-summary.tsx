// Adapted from saleor-storefront: src/checkout/views/saleor-checkout/order-summary.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ProductImage } from "@/ui/atoms/product-image";
import type { CheckoutView } from "../types";

/** The checkout's lines and totals, read-only: every figure was formatted on the server. */
export function OrderSummary({ checkout }: { checkout: CheckoutView }) {
  const t = useTranslations("checkout.summary");
  const shippingChosen = checkout.hasDeliveryMethod;

  return (
    <section aria-labelledby="checkout-summary-title" className="p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="checkout-summary-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <Link href="/cart" className="text-sm text-muted-foreground underline underline-offset-2">
          {t("editCart")}
        </Link>
      </div>

      <ul className="divide-y divide-border">
        {checkout.lines.map((line) => (
          <li key={line.id} className="flex gap-4 py-4 first:pt-0">
            <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
              <ProductImage image={line.image} sizes="64px" width={64} height={80} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{line.productName}</p>
              {line.variantName !== "" ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{line.variantName}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {t("quantity", { count: line.quantity })}
              </p>
            </div>
            <span className="text-sm font-medium tabular-nums">{line.totalPrice}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-2 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("subtotal")}</dt>
          <dd className="tabular-nums">{checkout.subtotal}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("shipping")}</dt>
          <dd className="tabular-nums">
            {shippingChosen ? checkout.shipping : t("shippingPending")}
          </dd>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
          <dt>{t("total")}</dt>
          <dd className="tabular-nums">{checkout.total}</dd>
        </div>
      </dl>
    </section>
  );
}
