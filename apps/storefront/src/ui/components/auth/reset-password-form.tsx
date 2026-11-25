"use client";

// Adapted from saleor-storefront: src/ui/components/auth/login-mode.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
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

export function ResetPasswordForm({ action }: { action: AuthAction }) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(action, idle);

  if (state.status === "success") {
    return (
      <AuthCard title={t("reset.successTitle")}>
        <p role="status" className="text-center text-muted-foreground">
          {t("reset.successBody", { email: state.email ?? "" })}
        </p>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className={linkClassName}>
            {t("reset.backToSignIn")}
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("reset.title")} intro={t("reset.description")}>
      <form action={formAction} className="space-y-4">
        <FormError state={state} />
        <Field
          name="email"
          type="email"
          icon="mail"
          placeholder={t("placeholders.email")}
          label={t("email")}
          autoComplete="email"
          spellCheck={false}
          required
          defaultValue={state.email}
          error={fieldError(state, "email")}
        />
        <SubmitButton label={t("reset.submit")} pendingLabel={t("reset.submitting")} />
      </form>
    </AuthCard>
  );
}
