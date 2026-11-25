// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/cart/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  type CartLoad,
  isCartUnavailable,
  type RemoveLineAction,
  type UpdateLineAction,
} from "@/lib/cart/types";
import { buttonClassName } from "@/ui/components/ui/button";
import { CartMessage } from "./cart-empty";
import { CartLineList } from "./cart-line-list";

interface CartPageContentProps {
  cart: CartLoad;
  updateLine: UpdateLineAction;
  removeLine: RemoveLineAction;
}

/** The `/cart` page body (Paper's layout): the lines, the subtotal, the checkout button. */
export function CartPageContent({ cart, updateLine, removeLine }: CartPageContentProps) {
  const t = useTranslations("cart");

  if (cart === null || isCartUnavailable(cart) || cart.lines.length === 0) {
    return (
      <>
        <h1 className="mt-8 text-balance text-h1 text-foreground">{t("title")}</h1>
        <div className="mt-8 min-h-64">
          <CartMessage kind={cart !== null && isCartUnavailable(cart) ? "unavailable" : "empty"} />
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-8 text-balance text-h1 text-foreground">{t("title")}</h1>
      <div className="mt-12">
        <CartLineList
          lines={cart.lines}
          updateLine={updateLine}
          removeLine={removeLine}
          variant="page"
        />
        <div className="mt-12">
          <div className="rounded-md border bg-muted px-4 py-2">
            <div className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="font-semibold text-foreground">{t("subtotal")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("shippingNote")}</p>
              </div>
              <div className="font-medium tabular-nums text-foreground">{cart.subtotal}</div>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/checkout"
              className={buttonClassName({
                asLink: true,
                size: "lg",
                className: "w-full sm:w-1/3",
              })}
            >
              {t("checkout")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
