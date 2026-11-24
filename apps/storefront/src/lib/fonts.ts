// Adapted from saleor-storefront: src/lib/fonts.ts (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { GeistSans } from "geist/font/sans";
import { cn } from "@/lib/utils";

/** `<html>` attributes: language and the self-hosted Geist variable (no Fraunces, no theme). */
export function getRootHtmlFontProps(lang: string) {
  return { lang, className: cn(GeistSans.variable, "min-h-dvh") };
}
