// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/account/orders/[number]/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type { OrderDetailView } from "@/lib/account/types";
import { AddressCard } from "@/ui/components/address/address-card";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderTimeline } from "./order-timeline";

/** An order of the signed-in customer: lines, totals, addresses, payment and the timeline. */
export function OrderDetail({ order }: { order: OrderDetailView }) {
  const t = useTranslations("orders");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-balance text-h1">{t("number", { number: order.number })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("placedOn", { date: order.createdLabel })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} pill />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-xl border">
            <div className="border-b px-5 py-4">
              <h2 className="text-sm font-semibold">
                {t("itemsHeading", { count: order.itemCount })}
              </h2>
            </div>
            <ul className="divide-y">
              {order.lines.map((line) => (
                <li key={line.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.productName}</p>
                    {line.variantName ? (
                      <p className="text-[13px] text-muted-foreground">{line.variantName}</p>
                    ) : null}
                    <p className="text-[13px] text-muted-foreground">
                      {t("quantity", { count: line.quantity })} ·{" "}
                      {t("unitPrice", { price: line.unitPrice })}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {line.totalPrice}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("subtotal")}</dt>
                <dd className="tabular-nums">{order.subtotal}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("shipping")}</dt>
                <dd className="tabular-nums">{order.shipping}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <dt>{t("total")}</dt>
                <dd className="tabular-nums">{order.total}</dd>
              </div>
            </dl>
          </div>
          <OrderTimeline entries={order.timeline} />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border px-5 py-4">
            <h3 className="mb-2 text-sm font-semibold">{t("payment")}</h3>
            <p className="text-sm">{t(`paymentState.${order.paymentState}`)}</p>
          </div>
          {order.shippingMethod ? (
            <div className="rounded-xl border px-5 py-4">
              <h3 className="mb-2 text-sm font-semibold">{t("shippingMethod")}</h3>
              <p className="text-sm">{order.shippingMethod}</p>
            </div>
          ) : null}
          {order.shippingAddress ? (
            <section aria-labelledby="order-shipping-address">
              <h3 id="order-shipping-address" className="mb-2 text-sm font-semibold">
                {t("shippingAddress")}
              </h3>
              <AddressCard address={order.shippingAddress} />
            </section>
          ) : null}
          {order.billingAddress ? (
            <section aria-labelledby="order-billing-address">
              <h3 id="order-billing-address" className="mb-2 text-sm font-semibold">
                {t("billingAddress")}
              </h3>
              <AddressCard address={order.billingAddress} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
