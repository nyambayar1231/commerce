// Adapted from saleor-storefront: src/ui/components/account/order-row.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { OrderSummaryView } from "@/lib/account/types";
import { OrderStatusBadge } from "./order-status-badge";

/** One order of the list: number, date and item count, status, total. Links to the detail. */
export function OrderRow({ order }: { order: OrderSummaryView }) {
  const t = useTranslations("orders");
  return (
    <Link
      href={`/account/orders/${encodeURIComponent(order.id)}`}
      prefetch={false}
      className="flex items-center gap-4 rounded-lg border px-5 py-4 transition-colors hover:bg-secondary/30"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t("number", { number: order.number })}</p>
        <p className="text-[13px] text-muted-foreground">
          <time dateTime={order.createdIso}>{order.createdLabel}</time>
          {" · "}
          {t("items", { count: order.itemCount })}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <OrderStatusBadge status={order.status} />
        <span className="text-sm font-semibold tabular-nums">{order.total}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
    </Link>
  );
}
