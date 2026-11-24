// Adapted from saleor-storefront: src/app/(checkout)/layout.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { ReactNode } from "react";
import { CheckoutHeaderFrame } from "@/ui/components/checkout-header-frame";

/** Checkout surface: minimal chrome, no footer navigation (ARCHITECTURE §10.3). */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CheckoutHeaderFrame />
      <main className="min-h-dvh">{children}</main>
    </>
  );
}
