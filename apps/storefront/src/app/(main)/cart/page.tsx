// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/cart/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { removeLine, updateLine } from "@/lib/cart/actions";
import { getCart } from "@/lib/cart/cart";
import { CartPageContent } from "@/ui/components/cart/cart-page-content";
import { CartPageSkeleton } from "@/ui/components/cart/cart-page-skeleton";

// The cart page (M4.5, ARCHITECTURE §10.9): per shopper, so the content is a dynamic island
// reading the checkout cookie; never indexed.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart");
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

async function CartContent() {
  const cart = await getCart();
  return <CartPageContent cart={cart} updateLine={updateLine} removeLine={removeLine} />;
}

export default function CartPage() {
  return (
    <section className="container-content py-8">
      <Suspense fallback={<CartPageSkeleton />}>
        <CartContent />
      </Suspense>
    </section>
  );
}
