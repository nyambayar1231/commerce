// Adapted from saleor-storefront: src/ui/components/pagination.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/ui/components/ui/button";

interface PaginationProps {
  /** `?before=<startCursor>` with the filters kept, or null when no page is before this one. */
  previousHref: string | null;
  /** `?after=<endCursor>` with the filters kept, or null when no page is after this one. */
  nextHref: string | null;
}

/**
 * Cursor pagination as previous/next links inside a labelled nav. Rendered as a server
 * component: the island builds both hrefs, and a direction without a page is a disabled span
 * (`buttonClassName`'s `aria-disabled:` styles), not a link. Hidden when there is only one page.
 */
export function Pagination({ previousHref, nextHref }: PaginationProps) {
  const t = useTranslations("pagination");
  if (previousHref === null && nextHref === null) return null;

  const linkClassName = buttonClassName({ asLink: true, className: "px-4 py-2" });

  return (
    <nav className="flex items-center justify-center gap-x-4 px-4 pt-12" aria-label={t("label")}>
      {previousHref === null ? (
        <span aria-disabled="true" className={linkClassName}>
          {t("previous")}
        </span>
      ) : (
        <Link href={previousHref} className={linkClassName} rel="prev">
          {t("previous")}
        </Link>
      )}

      {nextHref === null ? (
        <span aria-disabled="true" className={linkClassName}>
          {t("next")}
        </span>
      ) : (
        <Link href={nextHref} className={linkClassName} rel="next">
          {t("next")}
        </Link>
      )}
    </nav>
  );
}
