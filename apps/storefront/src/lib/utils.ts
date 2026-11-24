// Adapted from saleor-storefront: src/lib/utils.ts (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Custom semantic type tokens from tailwind.config.ts: registered so twMerge does not treat
 *  `text-display` + `text-foreground` as conflicting `text-*` utilities. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "lead", "eyebrow"] }],
      "text-color": [{ text: ["bestseller"] }],
      "border-color": [{ border: ["bestseller"] }],
    },
  },
});

/** Merge class names with clsx and tailwind-merge for proper Tailwind class deduplication */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
