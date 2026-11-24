// Adapted from saleor-storefront: src/ui/components/copyright-text.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

/**
 * Copyright line with the current year. Render it inside `<Suspense>`.
 *
 * `new Date()` during a prerender is sync IO and breaks the Cache Components prerender, so the
 * clock is read after `connection()`: the line becomes a small dynamic hole filled per request.
 * (Paper does this in a client component with `io()`; its resume falls back to client rendering,
 * so the year was missing from the server HTML.)
 */
export async function CopyrightText() {
  await connection();
  const t = await getTranslations();
  return t("footer.copyright", {
    year: new Date().getFullYear(),
    shopName: t("common.shopName"),
  });
}
