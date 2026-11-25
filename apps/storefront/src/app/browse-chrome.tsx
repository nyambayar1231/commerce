// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/main-chrome.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import { type ReactNode, Suspense } from "react";
import {
  CartButtonSlot,
  CartDrawerSlot,
  CopyrightSlot,
  FooterMenuSkeleton,
  FooterMenuSlot,
  MobileMenuSlot,
  MobileMenuSlotSkeleton,
  NavSlot,
  NavSlotSkeleton,
  ShopNameSkeleton,
  ShopNameSlot,
  UserMenuSkeleton,
  UserMenuSlot,
} from "@/app/chrome-slots";
import { CartButtonSkeleton } from "@/ui/components/cart/cart-button";
import { CartUIProvider } from "@/ui/components/cart/cart-context";
import { Footer } from "@/ui/components/footer";
import { HeaderFrame } from "@/ui/components/header-frame";
import { SearchBar } from "@/ui/components/nav/search-bar";

/**
 * Skip link, header, `<main>` and footer. Shared by the browse layout and the top-level 404, which
 * renders outside every route group. The nav, mobile menu and footer menu are cached data
 * islands; the search form reads no data, so it renders directly. The cart drawer and the header's
 * cart button share the open state through `CartUIProvider`.
 */
export function BrowseChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const shopName = (
    <Suspense fallback={<ShopNameSkeleton />}>
      <ShopNameSlot />
    </Suspense>
  );

  return (
    <CartUIProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-button focus:bg-background focus:px-4 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <HeaderFrame
        shopName={shopName}
        nav={
          <Suspense fallback={<NavSlotSkeleton />}>
            <NavSlot />
          </Suspense>
        }
        search={<SearchBar id="header-search" />}
        userMenu={
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenuSlot />
          </Suspense>
        }
        cart={
          <Suspense fallback={<CartButtonSkeleton />}>
            <CartButtonSlot />
          </Suspense>
        }
        mobileMenu={
          <Suspense fallback={<MobileMenuSlotSkeleton />}>
            <MobileMenuSlot />
          </Suspense>
        }
      />
      <Suspense fallback={null}>
        <CartDrawerSlot />
      </Suspense>
      <div className="flex min-h-[calc(100dvh-var(--header-height))] flex-col">
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer
          shopName={shopName}
          menu={
            <Suspense fallback={<FooterMenuSkeleton />}>
              <FooterMenuSlot />
            </Suspense>
          }
          copyright={
            // The year is read at request time; the fallback keeps the line's height.
            <Suspense fallback=" ">
              <CopyrightSlot />
            </Suspense>
          }
        />
      </div>
    </CartUIProvider>
  );
}
