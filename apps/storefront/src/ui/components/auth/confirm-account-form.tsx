"use client";

// Adapted from saleor-storefront: src/ui/components/auth/confirm-account-mode.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { AuthAction, AuthActionState } from "@/lib/auth/types";
import { buttonClassName } from "@/ui/components/ui/button";
import { AuthCard, FormError, SubmitButton } from "./auth-form-parts";

const idle: AuthActionState = { status: "idle" };

/** The account is confirmed by this button, never by opening the link (mail scanners open links). */
export function ConfirmAccountForm({
  action,
  email,
  token,
}: {
  action: AuthAction;
  email: string;
  token: string;
}) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(action, idle);

  if (state.status === "success") {
    return (
      <AuthCard title={t("confirm.successTitle")}>
        <p role="status" className="text-center text-muted-foreground">
          {t("confirm.successBody")}
        </p>
        <div className="mt-6">
          <Link href="/login" className={buttonClassName({ className: "h-12 w-full" })}>
            {t("confirm.goToSignIn")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("confirm.title")} intro={t("confirm.description", { email })}>
      <form action={formAction} className="space-y-4">
        <FormError state={state} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={token} />
        <SubmitButton label={t("confirm.submit")} pendingLabel={t("confirm.submitting")} />
      </form>
    </AuthCard>
  );
}
