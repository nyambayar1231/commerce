// Adapted from saleor-storefront: src/ui/components/plp/plp-empty-filter-results.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";

/** Empty state when the listing's filters match no products, with a link that clears them. */
export function PlpEmptyFilterResults({ clearHref }: { clearHref: string }) {
  const t = useTranslations("plp");

  return (
    <div className="py-12 text-center">
      <p className="text-lg text-muted-foreground">{t("noMatchingFilters")}</p>
      <Link
        href={clearHref}
        className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-4"
      >
        {t("clearFilters")}
      </Link>
    </div>
  );
}
