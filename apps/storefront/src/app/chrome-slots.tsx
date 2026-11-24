// CopyrightSlot adapted from saleor-storefront: src/ui/components/copyright-text.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { getShop } from "@/lib/content/shop";

// The chrome's data islands. They live in src/app because they call loaders; the frames in
// src/ui receive them as slots (ARCHITECTURE §10.3). Each one reads runtime data, so it is always
// rendered inside `<Suspense>` with a fallback of the same size.

/** The shop's name from the API (cached). */
export async function ShopNameSlot() {
  const shop = await getShop();
  return shop.name;
}

/** Skeleton for `ShopNameSlot`: reserves the line's height and about one name's width. */
export function ShopNameSkeleton() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[1em] w-32 animate-pulse rounded bg-muted align-middle"
    />
  );
}

/**
 * Copyright line with the current year. `new Date()` during a prerender is sync IO and breaks the
 * Cache Components prerender, so the clock is read after `connection()`: a small dynamic hole
 * filled per request.
 */
export async function CopyrightSlot() {
  await connection();
  const [t, shop] = await Promise.all([getTranslations("footer"), getShop()]);
  return t("copyright", { year: new Date().getFullYear(), shopName: shop.name });
}
