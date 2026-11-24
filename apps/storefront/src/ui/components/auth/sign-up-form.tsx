"use client";

// Adapted from saleor-storefront: src/ui/components/sign-up-form.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
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

export function SignUpForm({ action }: { action: AuthAction }) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(action, idle);

  if (state.status === "success") {
    return (
      <AuthCard title={t("signup.successTitle")}>
        <p role="status" className="text-center text-muted-foreground">
          {t("signup.successBody", { email: state.email ?? "" })}
        </p>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className={linkClassName}>
            {t("signup.goToSignIn")}
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("signup.title")}
      intro={
        <>
          {t("signup.hasAccount")}{" "}
          <Link href="/login" className={linkClassName}>
            {t("signup.signIn")}
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        <FormError state={state} />
        <div className="grid grid-cols-2 gap-4">
          <Field name="lastName" label={t("lastName")} autoComplete="family-name" />
          <Field name="firstName" label={t("firstName")} autoComplete="given-name" />
        </div>
        <Field
          name="email"
          type="email"
          label={t("email")}
          autoComplete="email"
          spellCheck={false}
          required
          defaultValue={state.email}
          error={fieldError(state, "email")}
        />
        <Field
          name="password"
          type="password"
          label={t("password")}
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
        <SubmitButton label={t("signup.submit")} pendingLabel={t("signup.submitting")} />
      </form>
    </AuthCard>
  );
}
