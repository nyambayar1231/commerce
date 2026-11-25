// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/account/orders/[number]/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getAccountOrder } from "@/lib/account/loaders";
import { AccountSectionSkeleton } from "@/ui/components/account/account-skeleton";
import { AccountLoadFailed } from "@/ui/components/account/account-unavailable";
import { OrderDetail } from "@/ui/components/account/order-detail";

type Params = Promise<{ id: string }>;

async function OrderContent({ params }: { params: Params }) {
  const [{ id }, t] = await Promise.all([params, getTranslations("orders")]);
  const result = await getAccountOrder(id);
  // The API answers an unknown id and another customer's order with the same GraphQL error.
  if (!result.ok && result.error.kind === "graphql") notFound();
  if (!result.ok) return <AccountLoadFailed title={t("title")} />;
  if (result.data === null) notFound();
  return <OrderDetail order={result.data} />;
}

export default function AccountOrderPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<AccountSectionSkeleton />}>
      <OrderContent params={params} />
    </Suspense>
  );
}
