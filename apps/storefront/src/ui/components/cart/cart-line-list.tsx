"use client";

// Adapted from saleor-storefront: src/ui/components/cart/cart-drawer.tsx and src/app/(storefront)/[locale]/[channel]/(main)/cart/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import type {
  CartErrorKey,
  CartLineView,
  RemoveLineAction,
  UpdateLineAction,
} from "@/lib/cart/types";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/ui/atoms/product-image";
import { useCartUI } from "./cart-context";
import { QuantityControl } from "./quantity-control";

interface CartLineListProps {
  lines: CartLineView[];
  updateLine: UpdateLineAction;
  removeLine: RemoveLineAction;
  /** The drawer's compact rows, or the cart page's roomier ones. */
  variant: "drawer" | "page";
}

function RemoveButton({ line, removeLine }: { line: CartLineView; removeLine: RemoveLineAction }) {
  const t = useTranslations("cart");
  const messageId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<CartErrorKey | null>(null);

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const state = await removeLine(line.id);
      if (state.status === "error") setError(state.message ?? "generic");
    });
  };

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-describedby={messageId}
        className="-mr-2 -mt-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{t("remove", { name: line.productName })}</span>
      </button>
      <p id={messageId} role="status" aria-live="polite" className="text-xs text-destructive">
        {error === null ? null : t(`errors.${error}`)}
      </p>
    </div>
  );
}

/** The cart's lines with a quantity control and a remove button each. */
export function CartLineList({ lines, updateLine, removeLine, variant }: CartLineListProps) {
  const t = useTranslations("cart");
  const { close } = useCartUI();
  const page = variant === "page";

  return (
    <ul
      data-testid="CartProductList"
      className={cn("divide-y divide-border", page && "border-y border-border")}
    >
      {lines.map((line) => (
        <li key={line.id} className={cn("flex gap-4 py-4", !page && "px-6")}>
          <Link
            href={line.href}
            onClick={close}
            tabIndex={-1}
            aria-hidden="true"
            className={cn(
              "block shrink-0 overflow-hidden rounded-lg bg-secondary",
              page ? "h-32 w-24 sm:h-40 sm:w-32" : "h-24 w-20",
            )}
          >
            <ProductImage
              image={line.image}
              sizes={page ? "128px" : "80px"}
              width={page ? 128 : 80}
              height={page ? 160 : 96}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={line.href}
                  onClick={close}
                  className="line-clamp-2 text-sm font-medium hover:underline"
                >
                  {line.productName}
                </Link>
                {line.variantName !== "" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("variant", { name: line.variantName })}
                  </p>
                )}
                {page && (
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {line.unitPrice}
                  </p>
                )}
              </div>
              <RemoveButton line={line} removeLine={removeLine} />
            </div>
            <div className="mt-3 flex items-start justify-between gap-2">
              <QuantityControl
                lineId={line.id}
                name={line.productName}
                quantity={line.quantity}
                maxQuantity={line.maxQuantity}
                updateLine={updateLine}
              />
              <span className="pt-2 text-sm font-medium tabular-nums">{line.totalPrice}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
