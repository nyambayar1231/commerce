"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CheckoutErrorKey } from "../types";

/** Messages that are fixed in the cart, not on this step: they link there. */
const CART_FIX: ReadonlySet<CheckoutErrorKey> = new Set([
  "insufficientStock",
  "notAvailable",
  "notFullyPaid",
]);

/** A step's form-level error in an `aria-live` region (always rendered, so it is announced). */
export function StepMessage({ message }: { message?: CheckoutErrorKey }) {
  const t = useTranslations("checkout.errors");
  return (
    <div aria-live="polite">
      {message ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="space-y-1 text-sm text-destructive">
            <p>{t(message)}</p>
            {CART_FIX.has(message) ? (
              <p>
                <Link href="/cart" className="font-medium underline underline-offset-2">
                  {t("goToCart")}
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
