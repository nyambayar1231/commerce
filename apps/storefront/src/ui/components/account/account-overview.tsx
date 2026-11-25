// Adapted from saleor-storefront: src/ui/components/account/{account-overview-welcome,account-overview-default-address,recent-orders-section}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AccountOverviewView, AddressView } from "@/lib/account/types";
import { AddressCard } from "@/ui/components/address/address-card";
import { OrderRow } from "./order-row";

const linkClassName =
  "inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

function DefaultAddress({ title, address }: { title: string; address: AddressView | null }) {
  const t = useTranslations("account.overview");
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href="/account/addresses" prefetch={false} className={linkClassName}>
          {t("manage")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {address ? (
        <AddressCard address={address} className="h-auto" />
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("noAddress")}
        </div>
      )}
    </section>
  );
}

/** Overview: welcome with the name, the default addresses and the newest orders. */
export function AccountOverview({
  name,
  overview,
}: {
  name: string;
  overview: AccountOverviewView;
}) {
  const t = useTranslations("account.overview");
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-balance text-h1">{t("welcome", { name })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <DefaultAddress title={t("defaultShipping")} address={overview.defaultShipping} />
        <DefaultAddress title={t("defaultBilling")} address={overview.defaultBilling} />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("recentOrders")}</h2>
          {overview.recentOrders.length > 0 ? (
            <Link href="/account/orders" prefetch={false} className={linkClassName}>
              {t("viewAll")}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        {overview.recentOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("noOrders")}
          </div>
        ) : (
          <div className="space-y-2">
            {overview.recentOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
