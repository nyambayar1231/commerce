// Adapted from saleor-storefront: src/ui/components/footer.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { CopyrightText } from "./copyright-text";

/** Footer frame: shop name and copyright. Menus and links come later. */
export function Footer() {
  const t = useTranslations();

  return (
    <footer className="bg-foreground text-background">
      <div className="container-content pb-24 pt-12 sm:pb-12 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-4 inline-block text-xl font-semibold">
              {t("common.shopName")}
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-inverse pt-8 sm:flex-row">
          <p className="text-xs text-inverse-muted">
            {/* The year is read at request time; the shell keeps the line's height. */}
            <Suspense fallback={" "}>
              <CopyrightText />
            </Suspense>
          </p>
        </div>
      </div>
    </footer>
  );
}
