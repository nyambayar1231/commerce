// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/{layout,main-chrome}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ReactNode } from "react";
import { BrowseChrome } from "@/ui/components/browse-chrome";

/** Browse pages: header, `<main>` (never inside a Suspense) and footer. */
export default function MainLayout({ children }: { children: ReactNode }) {
  return <BrowseChrome>{children}</BrowseChrome>;
}
