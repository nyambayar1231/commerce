// Adapted from saleor-storefront: src/ui/components/pdp/add-to-cart.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VariantStock } from "@/lib/catalog/types";
import { Button } from "@/ui/components/ui/button";

/** The add-to-cart button's three states, Paper's set: nothing chosen, sold out, ready. */
export type AddToCartState = "chooseVariant" | "outOfStock" | "ready";

interface AddToCartButtonProps {
  state: AddToCartState;
  /** The variant the action would add (M4.5); on the button for the action to read. */
  variantId: string | null;
  className?: string;
}

/**
 * The add-to-cart button. M4.3 ships it as a placeholder: every state renders the button
 * Paper shows (choose a variant / out of stock / add to cart), always disabled — M4.5
 * replaces its body with the Server Action. No quantity input.
 */
export function AddToCartButton({ state, variantId, className }: AddToCartButtonProps) {
  const t = useTranslations("pdp");
  const label =
    state === "chooseVariant"
      ? t("selectVariant")
      : state === "outOfStock"
        ? t("outOfStock")
        : t("addToCart");

  return (
    <Button
      type="submit"
      size="lg"
      disabled
      data-variant-id={variantId ?? undefined}
      className={className}
    >
      <ShoppingBag className="mr-2 h-5 w-5" />
      {label}
    </Button>
  );
}

interface AddToCartProps {
  /** The price line: the selected variant's, or the range when nothing is selected. */
  price: string;
  /** The selected variant's stock state; null when nothing is selected. */
  stock: { state: VariantStock; quantity: number | null } | null;
  buttonState: AddToCartState;
  variantId: string | null;
}

/**
 * The buy box's purchase block (Paper's `AddToCart`, without the discount labels our API has
 * no data for): the price with the stock state beside it, the add-to-cart button, and the
 * secure-checkout trust row.
 */
export function AddToCart({ price, stock, buttonState, variantId }: AddToCartProps) {
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
