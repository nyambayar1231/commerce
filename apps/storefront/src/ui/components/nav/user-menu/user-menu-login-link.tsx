"use client";

// Adapted from saleor-storefront: src/ui/components/nav/components/user-menu/user-menu-login-link.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const NO_NEXT = new Set(["/", "/login", "/signup"]);

/** Guest: a link to /login that returns to the current page afterwards. */
export function UserMenuLoginLink() {
  const t = useTranslations("userMenu");
  const pathname = usePathname();
  const href = NO_NEXT.has(pathname) ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;

  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <UserIcon className="h-5 w-5" aria-hidden="true" />
      {t("signIn")}
    </Link>
  );
}
