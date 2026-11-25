"use client";

// Adapted from saleor-storefront: src/checkout/views/saleor-checkout/checkout-header.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { STEPS } from "../types";

/**
 * The three checkout steps in the header, the current one `aria-current="step"`. It reads the
 * URL: the checkout page redirects to the step the checkout allows, so `?step=` is always the
 * real one. Earlier steps are links; later ones are not reachable yet. Outside `/checkout` (the
 * order page) it shows nothing.
 */
export function CheckoutSteps({ variant }: { variant: "desktop" | "mobile" }) {
  const t = useTranslations("checkout.steps");
  const pathname = usePathname();
  const requested = useSearchParams().get("step");
  if (pathname !== "/checkout") return null;

  const current = Math.max(
    STEPS.findIndex((step) => step === requested),
    0,
  );
  const total = STEPS.length;
  const label = t(STEPS[current] ?? "contact");

  if (variant === "mobile") {
    return (
      <nav className="mt-3 md:hidden" aria-label={t("ariaLabel")}>
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("stepOf", { step: current + 1, total })}</span>
          <span aria-current="step">{label}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full bg-foreground transition-all duration-300"
            style={{ width: `${((current + 1) / total) * 100}%` }}
          />
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="hidden items-center gap-2 md:flex" aria-label={t("ariaLabel")}>
        <ol className="flex items-center">
          {STEPS.map((step, index) => {
            const done = index < current;
            const body = (
              <>
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    index <= current
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    index <= current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(step)}
                </span>
              </>
            );
            return (
              <li key={step} className="flex items-center">
                {done ? (
                  <Link href={`/checkout?step=${step}`} className="flex items-center gap-2">
                    {body}
                  </Link>
                ) : (
                  <span
                    aria-current={index === current ? "step" : undefined}
                    className="flex items-center gap-2"
                  >
                    {body}
                  </span>
                )}
                {index < total - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn("mx-4 h-px w-8", done ? "bg-foreground" : "bg-border")}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
