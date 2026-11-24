// Adapted from saleor-storefront: src/app/global-error.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import "@/styles/brand.css";
import "@/app/globals.css";
import { GeistSans } from "geist/font/sans";
import { AlertCircle, RefreshCw } from "lucide-react";
import { buttonClassName } from "@/ui/components/ui/button";

/**
 * Catches errors thrown in the root layout itself. It replaces the crashed root, so it renders
 * its own `<html>`/`<body>` and, with no message provider available, its own Mongolian text.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="mn" className={`${GeistSans.variable} min-h-dvh`}>
      <body className="min-h-dvh font-sans">
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="mb-2 text-balance text-h1 text-foreground">Алдаа гарлаа</h1>
            <p className="mb-8 text-muted-foreground">Хуудсыг ачаалахад алдаа гарлаа.</p>
            <button type="button" onClick={reset} className={buttonClassName()}>
              <RefreshCw className="h-4 w-4" />
              Дахин оролдох
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
