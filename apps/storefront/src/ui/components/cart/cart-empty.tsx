"use client";

// Adapted from saleor-storefront: src/ui/components/cart/cart-drawer.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/ui/components/ui/button";
import { useCartUI } from "./cart-context";

/** The empty cart and the "cart unavailable" notice: a message and a way on. */
export function CartMessage({ kind }: { kind: "empty" | "unavailable" }) {
  const t = useTranslations("cart");
  const { close } = useCartUI();

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <ShoppingBag className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mb-2 text-lg font-medium">
        {kind === "empty" ? t("emptyTitle") : t("unavailableTitle")}
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        {kind === "empty" ? t("emptyBody") : t("unavailableBody")}
      </p>
      {kind === "empty" && (
        <Link href="/products" onClick={close} className={buttonClassName({ asLink: true })}>
          {t("browseProducts")}
        </Link>
      )}
    </div>
  );
}
