// Adapted from saleor-storefront: src/ui/components/not-found-content.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Home } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/ui/components/ui/button";

/** Shared 404 UI for `not-found.tsx` boundaries. */
export function NotFoundContent() {
  const t = useTranslations("notFound");
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <span className="mb-4 inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
          404
        </span>

        <h1 className="mb-2 text-balance text-h1 text-foreground">{t("title")}</h1>

        <p className="mb-8 text-muted-foreground">{t("description")}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className={buttonClassName({ asLink: true })}>
            <Home className="h-4 w-4" />
            {t("goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
