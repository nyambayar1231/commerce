// Adapted from saleor-storefront: src/checkout/views/order-confirmation/order-confirmation.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { CheckCircle, CreditCard, Mail, MapPin, Package } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { OrderStatusBadge } from "@/ui/components/account/order-status-badge";
import { AddressCard } from "@/ui/components/address/address-card";
import { buttonClassName } from "@/ui/components/ui/button";
import type { OrderConfirmationView } from "../types";

/**
 * The order page: thank you, number, status, the email it went to, addresses, delivery method,
 * lines and totals. Only what the customer may read (no staff-only fields). The page is the
 * order's token: whoever has the link sees it.
 */
export function OrderConfirmation({ confirmation }: { confirmation: OrderConfirmationView }) {
  const t = useTranslations("order");
  const o = useTranslations("orders");
  const { order, email } = confirmation;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="order-2 min-w-0 flex-1 md:order-1">
          <div className="rounded-lg border border-border bg-card p-6 md:p-8">
            <div className="space-y-8">
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle className="h-16 w-16 text-foreground" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-muted-foreground">{o("number", { number: order.number })}</p>
                  <h1 className="mt-1 text-balance text-h1">{t("thankYou")}</h1>
                  <div className="mt-2 flex justify-center">
                    <OrderStatusBadge status={order.status} pill />
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-secondary/50 p-4">
                  <h2 className="font-semibold">{t("confirmedTitle")}</h2>
                  {email !== "" ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("confirmedEmail", { email })}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-4 p-4">
                  {email !== "" ? (
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium">{t("emailSent")}</p>
                        <p className="text-sm text-muted-foreground">{email}</p>
                      </div>
                    </div>
                  ) : null}
                  {order.shippingAddress ? (
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-sm font-medium">{o("shippingAddress")}</p>
                        <AddressCard address={order.shippingAddress} />
                      </div>
                    </div>
                  ) : null}
                  {order.billingAddress ? (
                    <div className="flex items-start gap-3">
                      <CreditCard
                        className="mt-0.5 h-5 w-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-sm font-medium">{o("billingAddress")}</p>
                        <AddressCard address={order.billingAddress} />
                      </div>
                    </div>
                  ) : null}
                  {order.shippingMethod ? (
                    <div className="flex items-start gap-3">
                      <Package
                        className="mt-0.5 h-5 w-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-medium">{o("shippingMethod")}</p>
                        <p className="text-sm text-muted-foreground">{order.shippingMethod}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <Link
                  href="/products"
                  className={buttonClassName({ asLink: true, className: "min-w-[200px] px-8" })}
                >
                  {t("continueShopping")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <aside className="order-1 md:order-2 md:shrink-0 md:basis-[34%]">
          <section
            aria-labelledby="order-items-title"
            className="overflow-hidden rounded-lg border border-border bg-card md:sticky md:top-8"
          >
            <div className="p-6">
              <h2 id="order-items-title" className="mb-4 text-lg font-semibold">
                {o("itemsHeading", { count: order.itemCount })}
              </h2>
              <ul className="divide-y divide-border">
                {order.lines.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{line.productName}</p>
                      {line.variantName ? (
                        <p className="text-xs text-muted-foreground">{line.variantName}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {o("quantity", { count: line.quantity })}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {line.totalPrice}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{o("subtotal")}</dt>
                  <dd className="tabular-nums">{order.subtotal}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{o("shipping")}</dt>
                  <dd className="tabular-nums">{order.shipping}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                  <dt>{o("total")}</dt>
                  <dd className="tabular-nums">{order.total}</dd>
                </div>
              </dl>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
