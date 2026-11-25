// Adapted from saleor-storefront: src/ui/components/account/account-unavailable.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";

/** The session cookie exists but the profile could not be loaded: not the same as signed out. */
export function AccountUnavailable() {
  const t = useTranslations("account.unavailable");
  return (
    <section className="container-content py-8 pb-24">
      <div className="mx-auto my-16 w-full max-w-md text-center">
        <h1 className="text-balance text-h1">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("body")}</p>
      </div>
    </section>
  );
}

/** A section's data could not be loaded (the API is down), inside the account shell. */
export function AccountLoadFailed({ title }: { title: string }) {
  const t = useTranslations("account");
  return (
    <div className="space-y-6">
      <h1 className="text-balance text-h1">{title}</h1>
      <div
        role="alert"
        className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
      >
        {t("loadFailed")}
      </div>
    </div>
  );
}
