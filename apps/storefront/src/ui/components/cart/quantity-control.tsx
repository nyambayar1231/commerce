"use client";

// Adapted from saleor-storefront: src/ui/components/cart/cart-drawer.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";
import type { CartErrorKey, UpdateLineAction } from "@/lib/cart/types";

interface QuantityControlProps {
  lineId: string;
  /** The product's name, for the buttons' labels. */
  name: string;
  quantity: number;
  /** What is available; null when stock is not tracked. */
  maxQuantity: number | null;
  updateLine: UpdateLineAction;
}

/**
 * Shared by the drawer and the cart page: - / value / + with labelled buttons. The number is
 * optimistic (`useOptimistic`): it shows the new value at once and snaps back when the action
 * fails, with the reason in an `aria-live` region. Disabled while a change is in flight, and +
 * stops at the available stock.
 */
export function QuantityControl({
  lineId,
  name,
  quantity,
  maxQuantity,
  updateLine,
}: QuantityControlProps) {
  const t = useTranslations("cart");
  const messageId = useId();
  const [shown, setShown] = useOptimistic(quantity);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<CartErrorKey | null>(null);

  const change = (next: number) => {
    setError(null);
    startTransition(async () => {
      setShown(next);
      const state = await updateLine(lineId, next);
      if (state.status === "error") setError(state.message ?? "generic");
    });
  };

  const buttonClass =
    "flex h-9 w-9 items-center justify-center transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div>
      <fieldset
        aria-describedby={messageId}
        className="m-0 inline-flex min-w-0 items-center rounded-lg border border-border p-0"
      >
        <legend className="sr-only">{t("quantity", { name })}</legend>
        <button
          type="button"
          onClick={() => change(shown - 1)}
          disabled={pending || shown <= 1}
          className={buttonClass}
        >
          <Minus className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">{t("decrease", { name })}</span>
        </button>
        <span className="w-9 text-center text-sm font-medium tabular-nums" aria-live="off">
          {shown}
        </span>
        <button
          type="button"
          onClick={() => change(shown + 1)}
          disabled={pending || (maxQuantity !== null && shown >= maxQuantity)}
          className={buttonClass}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">{t("increase", { name })}</span>
        </button>
      </fieldset>
      <p id={messageId} role="status" aria-live="polite" className="mt-1 text-xs text-destructive">
        {error === null ? null : t(`errors.${error}`)}
      </p>
    </div>
  );
}
