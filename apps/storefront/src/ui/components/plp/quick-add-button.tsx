"use client";

// Adapted from saleor-storefront: src/ui/components/plp/quick-add-overlay.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AddToCartAction } from "@/lib/cart/types";
import { cn } from "@/lib/utils";
import { useAddToCart } from "@/ui/components/cart/use-add-to-cart";
import { Button } from "@/ui/components/ui/button";

interface QuickAddButtonProps {
  variantId: string;
  productName: string;
  /** The `addToCart` Server Action, passed down from the page through the grid. */
  addAction: AddToCartAction;
}

/**
 * Paper's quick-add overlay: a button over the bottom of a card's image, on desktop shown on
 * hover or keyboard focus (below `md` the card link goes to the product page). Adds one item,
 * opens the drawer on success and shows the reason on a failure. It sits beside the card's
 * links, never inside one.
 */
export function QuickAddButton({ variantId, productName, addAction }: QuickAddButtonProps) {
  const t = useTranslations("plp");
  const tCart = useTranslations("cart");
  const { add, pending, error } = useAddToCart(addAction);

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 hidden translate-y-2 p-3 opacity-0 transition-all duration-300 focus-within:translate-y-0 focus-within:opacity-100 md:block md:group-hover:translate-y-0 md:group-hover:opacity-100">
      <Button
        className={cn("w-full", pending && "cursor-wait opacity-70")}
        size="sm"
        type="button"
        // Not `disabled` while pending: a disabled button loses focus, and the drawer that opens
        // next returns focus to the element that had it.
        aria-disabled={pending}
        aria-busy={pending}
        aria-label={t("quickAddLabel", { name: productName })}
        onClick={() => add(variantId)}
      >
        <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {pending ? t("quickAdding") : t("quickAdd")}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={
          error === null
            ? undefined
            : "mt-1 rounded bg-background px-2 py-1 text-xs text-destructive"
        }
      >
        {error === null ? null : tCart(`errors.${error}`)}
      </p>
    </div>
  );
}
