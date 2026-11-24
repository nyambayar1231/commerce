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

export function LoginForm({ action, next }: { action: AuthAction; next?: string }) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState(action, idle);

  return (
    <AuthCard
      title={t("login.title")}
      intro={
        <>
          {t("login.noAccount")}{" "}
          <Link href="/signup" className={linkClassName}>
            {t("login.signUp")}
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        <FormError state={state} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
          autoComplete="current-password"
          required
          error={fieldError(state, "password")}
        />
        <div className="flex justify-end">
          <Link
            href="/reset-password"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground hover:no-underline"
          >
            {t("login.forgotPassword")}
          </Link>
        </div>
        <SubmitButton label={t("login.submit")} pendingLabel={t("login.submitting")} />
      </form>
    </AuthCard>
  );
}
