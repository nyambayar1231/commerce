// Adapted from saleor-storefront: src/checkout/views/saleor-checkout/saleor-checkout.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { chooseDelivery, placeOrder, saveShippingAddress, setEmail } from "@/checkout/actions";
import { CheckoutFrame } from "@/checkout/components/checkout-frame";
import { CheckoutMessage } from "@/checkout/components/checkout-message";
import { CheckoutSkeleton } from "@/checkout/components/checkout-skeleton";
import { ContactStep } from "@/checkout/components/contact-step";
import { OrderSummary } from "@/checkout/components/order-summary";
import { PaymentStep } from "@/checkout/components/payment-step";
import { ShippingStep } from "@/checkout/components/shipping-step";
import { effectiveStep } from "@/checkout/flow";
import { getCheckoutPage } from "@/checkout/loaders";
import { enabledProviders } from "@/checkout/payment/providers";
import { logout } from "@/lib/auth/actions";
import { getEnv } from "@/lib/env";

// The checkout (M4.6, ARCHITECTURE §10.9): one route, three steps (`?step=`), per shopper, so the
// content is a dynamic island reading the checkout cookie; never indexed. The URL always names the
// step the checkout allows: a request for a later one is redirected back to the furthest.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("title"), robots: { index: false, follow: false } };
}

type SearchParams = Promise<{ step?: string | string[] }>;

async function CheckoutContent({ searchParams }: { searchParams: SearchParams }) {
  const [{ step }, page] = await Promise.all([searchParams, getCheckoutPage()]);
  if (page.status !== "ready") return <CheckoutMessage kind={page.status} />;

  const { checkout, session, savedAddresses, countries } = page;
  const requested = Array.isArray(step) ? step[0] : step;
  const current = effectiveStep(requested, checkout);
  if (requested !== current) redirect(`/checkout?step=${current}`);

  const providers = enabledProviders(getEnv().paymentProviders);
  const defaultShipping = savedAddresses.find((address) => address.isDefaultShipping) ?? null;

  return (
    <CheckoutFrame summary={<OrderSummary checkout={checkout} />}>
      {current === "contact" ? (
        <ContactStep session={session} email={checkout.email} setEmail={setEmail} logout={logout} />
      ) : current === "shipping" ? (
        <ShippingStep
          countries={countries}
          savedAddresses={savedAddresses}
          address={checkout.shippingAddress}
          fallbackAddress={defaultShipping}
          methods={checkout.shippingMethods}
          selectedMethodId={checkout.shippingMethodId}
          saveShippingAddress={saveShippingAddress}
          chooseDelivery={chooseDelivery}
        />
      ) : (
        <PaymentStep
          attemptId={crypto.randomUUID()}
          providerIds={providers.map((provider) => provider.id)}
          countries={countries}
          placeOrder={placeOrder}
        />
      )}
    </CheckoutFrame>
  );
}

export default function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent searchParams={searchParams} />
    </Suspense>
  );
}
