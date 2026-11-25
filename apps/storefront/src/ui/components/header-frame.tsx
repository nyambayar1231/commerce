// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/browse-header-frame.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Header frame: shop name, fixed-size slots for nav, search and cart (filled by the app layer,
 * so later islands don't shift the layout), the user menu and the cart button. `nav` is the
 * desktop links (hidden below `lg`, where the mobile menu button takes over); `search` is the search form
 * (hidden below `md`); `mobileMenu` is the menu button that opens the mobile dialog.
 */
export function HeaderFrame({
  shopName,
  nav,
  search,
  userMenu,
  cart,
  mobileMenu,
}: {
  shopName: ReactNode;
  nav: ReactNode;
  search: ReactNode;
  userMenu: ReactNode;
  cart: ReactNode;
  mobileMenu: ReactNode;
}) {
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
          >
            {nav}
          </nav>

          <div className="hidden md:flex md:max-w-md md:flex-1 md:justify-end lg:flex-none">
            {search}
          </div>

          <div className="flex items-center gap-1">
            {userMenu}
            {cart}
            {mobileMenu}
          </div>
        </div>
      </div>
    </header>
  );
}
