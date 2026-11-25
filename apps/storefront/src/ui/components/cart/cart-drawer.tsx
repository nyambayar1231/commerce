"use client";

// Adapted from saleor-storefront: src/ui/components/cart/cart-drawer.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { ShoppingBag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCartUI } from "./cart-context";

// Paper's cart sheet rebuilt on a native `<dialog>` (no dialog library): `showModal()` traps focus
// and Escape closes it; the browser returns focus to the element that had it. The open state is
// the provider's, so the header button and the add-to-cart buttons can open it; the dialog's
// own `close` event (Escape, the close button, a backdrop click) writes it back.

/** The drawer's frame: title, close button, and the server-rendered contents. */
export function CartDrawer({ itemCount, children }: { itemCount: number; children: ReactNode }) {
  const t = useTranslations("cart");
  const { isOpen, close } = useCartUI();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (isOpen && !element.open) element.showModal();
    if (!isOpen && element.open) element.close();
  }, [isOpen]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    // A click on the backdrop lands on the dialog element itself (its content fills the box).
    const onBackdropClick = (event: MouseEvent) => {
      if (event.target === element) close();
    };
    element.addEventListener("close", close);
    element.addEventListener("click", onBackdropClick);
    return () => {
      element.removeEventListener("close", close);
      element.removeEventListener("click", onBackdropClick);
    };
  }, [close]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="cart-drawer-title"
      className={cn(
        "m-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-none bg-background p-0",
        "backdrop:bg-foreground/50",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            <h2 id="cart-drawer-title" className="text-lg font-semibold">
              {t("drawerTitle")}
            </h2>
            {itemCount > 0 && (
              <span className="text-sm text-muted-foreground">
                ({t("itemCount", { count: itemCount })})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
