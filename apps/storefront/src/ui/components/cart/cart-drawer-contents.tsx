"use client";

// Adapted from saleor-storefront: src/ui/components/cart/cart-drawer.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  type CartLoad,
  isCartUnavailable,
  type RemoveLineAction,
  type UpdateLineAction,
} from "@/lib/cart/types";
import { buttonClassName } from "@/ui/components/ui/button";
import { useCartUI } from "./cart-context";
import { CartMessage } from "./cart-empty";
import { CartLineList } from "./cart-line-list";

interface CartDrawerContentsProps {
  cart: CartLoad;
  updateLine: UpdateLineAction;
  removeLine: RemoveLineAction;
}

/** What the drawer shows: the lines and summary, or the empty or unavailable message. */
export function CartDrawerContents({ cart, updateLine, removeLine }: CartDrawerContentsProps) {
  const t = useTranslations("cart");
  const { close } = useCartUI();

  if (cart === null || isCartUnavailable(cart) || cart.lines.length === 0) {
    const kind = cart !== null && isCartUnavailable(cart) ? "unavailable" : "empty";
    return (
      <div className="flex-1">
        <CartMessage kind={kind} />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <CartLineList
          lines={cart.lines}
          updateLine={updateLine}
          removeLine={removeLine}
          variant="drawer"
        />
      </div>
      <div className="border-t border-border bg-background">
        <div className="flex items-center justify-between px-6 py-4 text-base font-semibold">
          <span>{t("subtotal")}</span>
          <span className="tabular-nums">{cart.subtotal}</span>
        </div>
        <div className="space-y-3 px-6 pb-6">
          <Link
            href="/checkout"
            onClick={close}
            className={buttonClassName({
              asLink: true,
              size: "lg",
              className: "group h-12 w-full",
            })}
          >
            <span>{t("checkout")}</span>
            <ArrowRight
              className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/cart"
            onClick={close}
            className={buttonClassName({
              asLink: true,
              variant: "outline-solid",
              size: "lg",
              className: "h-12 w-full",
            })}
          >
            {t("viewCart")}
          </Link>
        </div>
      </div>
    </>
  );
}
