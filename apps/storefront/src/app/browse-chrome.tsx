// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/main-chrome.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import { type ReactNode, Suspense } from "react";
import {
  CopyrightSlot,
  ShopNameSkeleton,
  ShopNameSlot,
  UserMenuSkeleton,
  UserMenuSlot,
} from "@/app/chrome-slots";
import { Footer } from "@/ui/components/footer";
import { HeaderFrame } from "@/ui/components/header-frame";

/**
 * Skip link, header, `<main>` and footer. Shared by the browse layout and the top-level 404, which
 * renders outside every route group.
 */
export function BrowseChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const shopName = (
    <Suspense fallback={<ShopNameSkeleton />}>
      <ShopNameSlot />
    </Suspense>
  );

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-button focus:bg-background focus:px-4 focus:py-2"
      >
        {t("skipToContent")}
      </a>
      <HeaderFrame
        shopName={shopName}
        userMenu={
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenuSlot />
          </Suspense>
        }
      />
      <div className="flex min-h-[calc(100dvh-var(--header-height))] flex-col">
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer
          shopName={shopName}
          copyright={
            // The year is read at request time; the fallback keeps the line's height.
            <Suspense fallback=" ">
              <CopyrightSlot />
            </Suspense>
          }
        />
      </div>
    </>
  );
}
