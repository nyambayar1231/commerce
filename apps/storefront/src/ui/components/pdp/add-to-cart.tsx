// Adapted from saleor-storefront: src/ui/components/pdp/add-to-cart.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AddToCartAction } from "@/lib/cart/types";
import type { VariantStock } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import { useAddToCart } from "@/ui/components/cart/use-add-to-cart";
import { Button } from "@/ui/components/ui/button";

/** The add-to-cart button's three states, Paper's set: nothing chosen, sold out, ready. */
export type AddToCartState = "chooseVariant" | "outOfStock" | "ready";

interface AddToCartButtonProps {
  state: AddToCartState;
  /** The variant the action adds; null while nothing is chosen. */
  variantId: string | null;
  /** The `addToCart` Server Action, passed down from the page. */
  addAction: AddToCartAction;
  className?: string;
  /** Classes of the message under the button (the sticky bar floats it above the bar). */
  messageClassName?: string;
}

/**
 * The add-to-cart button, Paper's three states (choose a variant / out of stock / add to cart).
 * Only a chosen, buyable variant enables it; one click adds one item, opens the cart drawer on
 * success and shows the API's reason under the button when it fails. No quantity input.
 */
export function AddToCartButton({
  state,
  variantId,
  addAction,
  className,
  messageClassName,
}: AddToCartButtonProps) {
  const t = useTranslations("pdp");
  const tCart = useTranslations("cart");
  const { add, pending, error } = useAddToCart(addAction);
  const label =
    state === "chooseVariant"
      ? t("selectVariant")
      : state === "outOfStock"
        ? t("outOfStock")
        : pending
          ? t("adding")
          : t("addToCart");

  return (
    <>
      <Button
        type="button"
        size="lg"
        disabled={state !== "ready" || variantId === null}
        // Not `disabled` while pending: a disabled button loses focus, and the drawer that opens
        // next returns focus to the element that had it.
        aria-disabled={pending}
        aria-busy={pending}
        onClick={() => variantId !== null && add(variantId)}
        data-variant-id={variantId ?? undefined}
        className={cn(className, pending && "cursor-wait opacity-70")}
      >
        <ShoppingBag className="mr-2 h-5 w-5" aria-hidden="true" />
        {label}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={cn("text-sm text-destructive", messageClassName)}
      >
        {error === null ? null : tCart(`errors.${error}`)}
      </p>
    </>
  );
}

interface AddToCartProps {
  /** The price line: the selected variant's, or the range when nothing is selected. */
  price: string;
  /** The selected variant's stock state; null when nothing is selected. */
  stock: { state: VariantStock; quantity: number | null } | null;
  buttonState: AddToCartState;
  variantId: string | null;
  addAction: AddToCartAction;
}

/**
 * The buy box's purchase block (Paper's `AddToCart`, without the discount labels our API has
 * no data for): the price with the stock state beside it, the add-to-cart button, and the
 * secure-checkout trust row.
 */
export function AddToCart({ price, stock, buttonState, variantId, addAction }: AddToCartProps) {
  const t = useTranslations("pdp");
  const tCheckout = useTranslations("checkout");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{price}</span>
        {stock !== null && (
          <span className="text-sm text-muted-foreground">
            {stock.state === "inStock"
              ? t("inStock")
              : stock.state === "lowStock"
                ? t("lowStock", { count: stock.quantity ?? 0 })
                : t("outOfStock")}
          </span>
        )}
      </div>

      <AddToCartButton
        state={buttonState}
        variantId={variantId}
        addAction={addAction}
        className="h-14 w-full text-base font-medium"
      />

      <div className="flex items-center justify-center gap-6 pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {tCheckout("secureCheckout")}
        </span>
      </div>
    </div>
  );
}
