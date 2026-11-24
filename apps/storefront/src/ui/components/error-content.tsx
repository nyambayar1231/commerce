// Adapted from saleor-storefront: src/ui/components/error-content.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { AlertCircle, ArrowLeft, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/ui/components/ui/button";

export interface ErrorContentProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Error UI for `error.tsx`. Never shows the error's message or stack, only its digest. */
export function ErrorContent({ error, reset }: ErrorContentProps) {
  const t = useTranslations("error");

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>

        <h1 className="mb-2 text-balance text-h1 text-foreground">{t("title")}</h1>

        <p className="mb-8 text-muted-foreground">{t("description")}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className={buttonClassName()}>
            <RefreshCw className="h-4 w-4" />
            {t("retry")}
          </button>

          <Link href="/" className={buttonClassName({ asLink: true, variant: "outline-solid" })}>
            <Home className="h-4 w-4" />
            {t("goHome")}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("goBack")}
        </button>

        {error.digest && (
          <p className="mt-8 text-xs text-muted-foreground/60">
            {t("errorId", { digest: error.digest })}
          </p>
        )}
      </div>
    </div>
  );
}
