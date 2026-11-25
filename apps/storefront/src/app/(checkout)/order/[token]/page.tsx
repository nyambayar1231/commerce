// Adapted from saleor-storefront: src/checkout/views/order-confirmation/order-confirmation.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CheckoutMessage } from "@/checkout/components/checkout-message";
import { CheckoutSkeleton } from "@/checkout/components/checkout-skeleton";
import { OrderConfirmation } from "@/checkout/components/order-confirmation";
import { getOrderByToken } from "@/checkout/loaders";

// The order page (M4.6, ARCHITECTURE §10.9): per request, never cached, never indexed. The random
// token in the URL is the credential; a token that is not a UUID or matches no order is a 404.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("order");
  return { title: t("title"), robots: { index: false, follow: false } };
}

type Params = Promise<{ token: string }>;

async function OrderContent({ params }: { params: Params }) {
  const { token } = await params;
  const confirmation = await getOrderByToken(token);
  if (confirmation === null) notFound();
  if (confirmation === "unavailable") return <CheckoutMessage kind="unavailable" />;
  return <OrderConfirmation confirmation={confirmation} />;
}

export default function OrderPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <OrderContent params={params} />
    </Suspense>
  );
}
