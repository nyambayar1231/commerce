// Adapted from saleor-storefront: src/ui/components/nav/components/search-bar.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The header search form: a plain GET `<form action="/search">` inside a `<search>` landmark
 * (the element is the `role="search"` the brief asks for, and what Biome's `useSemanticElements`
 * requires), so it works without JavaScript (Paper's Server Action is dropped; ARCHITECTURE
 * §10.7 keeps `/search` uncached and out of the sitemap). `id` distinguishes the header input
 * from the one inside the mobile menu's dialog.
 */
export function SearchBar({ id }: { id: string }) {
  const t = useTranslations("search");

  return (
    <search>
      <form action="/search" className="group relative w-full max-w-md">
        <label className="relative block" htmlFor={id}>
          <span className="sr-only">{t("label")}</span>
          <span
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4"
            aria-hidden="true"
          >
            <SearchIcon className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-foreground" />
          </span>
          <input
            id={id}
            type="text"
            name="q"
            maxLength={100}
            placeholder={t("placeholder")}
            autoComplete="off"
            required
            className="hover:bg-secondary/80 focus:outline-hidden h-10 w-full rounded-lg border border-transparent bg-secondary py-2 pl-11 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground hover:border-border focus:border-ring focus:bg-background focus:ring-1 focus:ring-ring"
          />
        </label>
      </form>
    </search>
  );
}
