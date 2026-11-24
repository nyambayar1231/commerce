"use client";

// Adapted from saleor-storefront: src/ui/components/auth/set-password-mode.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { AuthAction, AuthActionState } from "@/lib/auth/types";
import {
  AuthCard,
  Field,
  FormError,
  fieldError,
  linkClassName,
  SubmitButton,
} from "./auth-form-parts";

const idle: AuthActionState = { status: "idle" };

export function SetPasswordForm({
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

  return (
    <AuthCard title={t("setPassword.title")} intro={email}>
      <form action={formAction} className="space-y-4">
        <FormError state={state} />
        {state.status === "error" && state.message === "linkInvalid" ? (
          <p className="text-center text-sm">
            <Link href="/reset-password" className={linkClassName}>
              {t("setPassword.requestNew")}
            </Link>
          </p>
        ) : null}
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={token} />
        <Field
          name="password"
          type="password"
          label={t("newPassword")}
          hint={t("passwordHint")}
          autoComplete="new-password"
          required
          minLength={8}
          error={fieldError(state, "password")}
        />
        <Field
          name="confirm"
          type="password"
          label={t("confirmPassword")}
          autoComplete="new-password"
          required
          error={fieldError(state, "confirm")}
        />
        <SubmitButton label={t("setPassword.submit")} pendingLabel={t("setPassword.submitting")} />
      </form>
    </AuthCard>
  );
}
