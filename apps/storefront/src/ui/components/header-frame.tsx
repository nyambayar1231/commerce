// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/browse-header-frame.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Header frame: shop name, the user menu and fixed-size slots for nav, search and cart (empty until
 * their steps, so later islands don't shift the layout).
 */
export function HeaderFrame({ shopName, userMenu }: { shopName: ReactNode; userMenu: ReactNode }) {
  const t = useTranslations();

  return (
    <header
      id="storefront-header"
      className="relative sticky top-0 z-40 border-b border-border bg-background"
    >
      <div className="container-nav">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="shrink-0 text-xl font-semibold text-foreground">
            {shopName}
          </Link>

          <nav
            aria-label={t("nav.main")}
            className="hidden flex-1 justify-center lg:ml-10 lg:flex xl:ml-14"
          />

          <div className="hidden md:flex md:max-w-md md:flex-1 md:justify-end lg:flex-none" />

          <div className="flex items-center gap-1">
            {userMenu}
            <div className="h-10 w-10" aria-hidden="true" />
          </div>
        </div>
      </div>
    </header>
  );
}
