// Adapted from saleor-storefront: src/ui/components/account/order-status-badge.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { CheckCircle2, Clock, PackageCheck, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OrderStatusKey } from "@/lib/account/types";
import { cn } from "@/lib/utils";

// Icon and design-token colors per status (never hard-coded colors, ARCHITECTURE §10.12).
const STYLE = {
  UNFULFILLED: { icon: Clock, className: "text-muted-foreground" },
  PARTIALLY_FULFILLED: { icon: PackageCheck, className: "text-foreground" },
  FULFILLED: { icon: CheckCircle2, className: "text-success" },
  CANCELED: { icon: XCircle, className: "text-destructive" },
} as const;

/** The order status in Mongolian. `pill` is the detail page's badge; the default is a list row's. */
export function OrderStatusBadge({
  status,
  pill = false,
}: {
  status: OrderStatusKey;
  pill?: boolean;
}) {
  const t = useTranslations("orders.status");
  const { icon: Icon, className } = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium",
        pill && "rounded-full border border-border bg-secondary px-3 py-1 text-sm",
        className,
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      <span className={pill ? undefined : "hidden sm:inline"}>{t(status)}</span>
      {/* The label is hidden on small rows; screen readers still get it. */}
      {pill ? null : <span className="sr-only sm:hidden">{t(status)}</span>}
    </span>
  );
}
