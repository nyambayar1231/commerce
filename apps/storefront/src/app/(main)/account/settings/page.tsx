// Adapted from saleor-storefront: src/app/(storefront)/[locale]/[channel]/(main)/account/settings/page.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { changePassword, updateName } from "@/lib/account/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AccountSectionSkeleton } from "@/ui/components/account/account-skeleton";
import { ChangePasswordForm, EditNameForm } from "@/ui/components/account/settings-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.settings");
  return { title: t("title") };
}

async function SettingsContent() {
  const [current, t] = await Promise.all([getCurrentUser(), getTranslations("account.settings")]);
  if (current.status !== "authenticated") return null; // the layout already showed the gate
  const { user } = current;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-balance text-h1">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="divide-y rounded-lg border">
        <div className="p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">{t("email")}</p>
          <p className="break-all font-medium">{user.email}</p>
        </div>
        <div className="p-4 sm:p-6">
          <EditNameForm action={updateName} firstName={user.firstName} lastName={user.lastName} />
        </div>
        <div className="p-4 sm:p-6">
          <ChangePasswordForm action={changePassword} />
        </div>
      </div>
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <Suspense fallback={<AccountSectionSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
