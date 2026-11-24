// Adapted from saleor-storefront: src/ui/components/nav/components/user-menu/user-menu-unavailable.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The API can't be reached, so we don't know whether the shopper is signed in: no sign-in link
 * (that would say "signed out"), only a muted icon that explains itself.
 */
export function UserMenuUnavailable() {
  const t = useTranslations("userMenu");

  return (
    <span
      role="img"
      title={t("unavailableTitle")}
      aria-label={t("unavailableLabel")}
      className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground"
    >
      <UserIcon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}
