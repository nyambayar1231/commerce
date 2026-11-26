import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClassName } from "@/ui/components/ui/button";

// While a payment is confirmed at the gateway (ADR-0016): the page asks again every few seconds
// through /checkout/return, without JavaScript (a meta refresh), until the order exists or the
// payment is known to have failed. The order is made by the API either way.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout.pending");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function PaymentPendingPage() {
  const t = await getTranslations("checkout.pending");
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8">
      <meta httpEquiv="refresh" content="4;url=/checkout/return" />
      <div
        className="rounded-lg border border-border bg-card p-8 text-center shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Loader2
            className="h-8 w-8 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-hidden="true"
          />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mb-8 text-muted-foreground">{t("body")}</p>
        <div className="flex flex-col gap-3">
          <a
            href="/checkout/return"
            className={buttonClassName({ asLink: true, size: "lg", className: "h-12 w-full" })}
          >
            {t("check")}
          </a>
          <Link
            href="/checkout?step=payment"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            {t("back")}
          </Link>
        </div>
      </div>
    </div>
  );
}
