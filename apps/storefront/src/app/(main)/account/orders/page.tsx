// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/account/orders/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getOrdersPage } from "@/lib/account/loaders";
import { AccountSectionSkeleton } from "@/ui/components/account/account-skeleton";
import { AccountLoadFailed } from "@/ui/components/account/account-unavailable";
import { OrderRow } from "@/ui/components/account/order-row";
import { Pagination } from "@/ui/components/pagination";
import { buttonClassName } from "@/ui/components/ui/button";

type SearchParams = Promise<{ after?: string | string[]; before?: string | string[] }>;

const first = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value) || undefined;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title") };
}

async function OrdersContent({ searchParams }: { searchParams: SearchParams }) {
  const [params, t] = await Promise.all([searchParams, getTranslations("orders")]);
  const after = first(params.after);
  const before = first(params.before);
  const result = await getOrdersPage({ after, before });
  if (!result.ok) return <AccountLoadFailed title={t("title")} />;
  const { orders, previousCursor, nextCursor } = result.data;

  return (
    <div className="space-y-6">
      <h1 className="text-balance text-h1">{t("title")}</h1>
      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">{t("empty")}</p>
          <Link href="/products" className={buttonClassName({ asLink: true, className: "mt-4" })}>
            {t("browse")}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
          <Pagination
            previousHref={
              previousCursor ? `/account/orders?before=${encodeURIComponent(previousCursor)}` : null
            }
            nextHref={nextCursor ? `/account/orders?after=${encodeURIComponent(nextCursor)}` : null}
          />
        </>
      )}
    </div>
  );
}

export default function AccountOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AccountSectionSkeleton />}>
      <OrdersContent searchParams={searchParams} />
    </Suspense>
  );
}
