// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/account/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getAccountOverview } from "@/lib/account/loaders";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AccountOverview } from "@/ui/components/account/account-overview";
import { AccountSectionSkeleton } from "@/ui/components/account/account-skeleton";
import { AccountLoadFailed } from "@/ui/components/account/account-unavailable";

async function OverviewContent() {
  const [current, overview, t] = await Promise.all([
    getCurrentUser(),
    getAccountOverview(),
    getTranslations("account.nav"),
  ]);
  if (current.status !== "authenticated") return null; // the layout already showed the gate
  if (!overview.ok) return <AccountLoadFailed title={t("overview")} />;
  const { user } = current;
  const name = user.firstName.trim() || user.email.split("@")[0] || user.email;
  return <AccountOverview name={name} overview={overview.data} />;
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSectionSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}
