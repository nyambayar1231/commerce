// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/account/layout.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { login, logout } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AccountLogin } from "@/ui/components/account/account-login";
import { AccountNav } from "@/ui/components/account/account-nav";
import { AccountSkeleton } from "@/ui/components/account/account-skeleton";
import { AccountUnavailable } from "@/ui/components/account/account-unavailable";

/**
 * Never prefetch an account page: it reads the session, so a prefetch would render it at request
 * time on the server for every header link in view (Paper's layout sets the same).
 */
export const prefetch = "force-disabled";

/** Every account page is private: dynamic (it reads the session) and never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.metadata");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The account gate (ARCHITECTURE §10.8): the session is read once here. A guest sees the sign-in
 * form in place of the page and returns to it; an API outage shows the unavailable state, never
 * "signed out"; a customer gets the sidebar and the page.
 */
async function AccountShell({ children }: { children: ReactNode }) {
  const current = await getCurrentUser();
  if (current.status === "guest") return <AccountLogin action={login} />;
  if (current.status === "unavailable") return <AccountUnavailable />;

  return (
    <div className="container-content py-8">
      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="shrink-0 md:min-h-[60vh] md:w-52">
          <AccountNav user={current.user} logoutAction={logout} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountShell>{children}</AccountShell>
    </Suspense>
  );
}
