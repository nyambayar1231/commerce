// Adapted from saleor-storefront: src/ui/components/account/address-card.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { AddressView } from "@/lib/account/types";
import { cn } from "@/lib/utils";

/**
 * A saved or order address, written big to small as Mongolians do: aimag or capital, sum or
 * district, bag or khoroo, then street. `actions` sit top right, `footer` under a rule. The
 * default badges show only for an address that is its customer's default.
 */
export function AddressCard({
  address,
  actions,
  footer,
  className,
}: {
  address: AddressView;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("address");
  const area = [address.countryArea, address.city, address.cityArea].filter(Boolean).join(", ");
  const lines = [
    address.companyName,
    area,
    address.streetAddress1,
    address.streetAddress2,
    address.postalCode,
    address.countryName,
  ].filter(Boolean);

  return (
    <div className={cn("flex h-full flex-col rounded-lg border p-4", className)}>
      <div className="flex flex-1 items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {address.firstName} {address.lastName}
            </span>
            {address.isDefaultShipping ? (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t("defaultShipping")}
              </span>
            ) : null}
            {address.isDefaultBilling ? (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t("defaultBilling")}
              </span>
            ) : null}
          </div>
          {lines.map((line) => (
            <p key={line} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
          {address.phone ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("phoneLabel", { phone: address.phone })}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {footer ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
