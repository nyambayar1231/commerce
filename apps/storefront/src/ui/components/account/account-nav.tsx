// Adapted from saleor-storefront: src/ui/components/account/account-nav.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { ArrowLeft, LayoutGrid, MapPin, Receipt, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CustomerSummary } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/account", key: "overview", icon: LayoutGrid, exact: true },
  { href: "/account/orders", key: "orders", icon: Receipt },
  { href: "/account/addresses", key: "addresses", icon: MapPin },
  { href: "/account/settings", key: "settings", icon: Settings },
] as const;

/** Account sidebar (a tab bar on small screens): the customer, the sections and sign out. */
export function AccountNav({
  user,
  logoutAction,
}: {
  user: CustomerSummary;
  logoutAction: () => Promise<void>;
}) {
  const t = useTranslations("account.nav");
  const pathname = usePathname();
  const name = `${user.firstName} ${user.lastName}`.trim();
  const initials =
    user.firstName && user.lastName
      ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`
      : user.email.slice(0, 2);

  return (
    <div className="flex flex-col">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="text-base leading-none" aria-hidden="true">
          &lsaquo;
        </span>
        {t("backToStore")}
      </Link>

      <div className="mb-8 hidden md:block">
        <div
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-sm font-bold uppercase text-background"
          aria-hidden="true"
        >
          {initials}
        </div>
        {name ? <p className="font-semibold leading-tight">{name}</p> : null}
        <p className="mt-0.5 break-all text-sm text-muted-foreground">{user.email}</p>
      </div>

      <nav
        aria-label={t("ariaLabel")}
        className={cn(
          "grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-secondary/60 p-1",
          "md:flex md:flex-col md:gap-0.5 md:rounded-none md:bg-transparent md:p-0",
        )}
      >
        {navItems.map((item) => {
          const active = "exact" in item ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center text-xs font-medium transition-colors",
                "md:flex-row md:justify-start md:gap-3 md:px-3.5 md:py-2.5 md:text-sm",
                active
                  ? "bg-foreground text-background shadow-sm md:shadow-none"
                  : "text-muted-foreground md:hover:bg-secondary md:hover:text-foreground",
              )}
            >
              <Icon
                className="h-5 w-5 shrink-0 md:h-[18px] md:w-[18px]"
                strokeWidth={active ? 2 : 1.75}
                aria-hidden="true"
              />
              <span className="max-w-full truncate">{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <form action={logoutAction} className="mt-4 md:mt-auto md:pt-10">
        <button
          type="submit"
          className="flex items-center gap-3 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
          {t("signOut")}
        </button>
      </form>
    </div>
  );
}
