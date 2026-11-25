// Adapted from saleor-storefront: src/ui/components/account/{edit-name-form,change-password-form}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type {
  PasswordAction,
  PasswordActionState,
  ProfileAction,
  ProfileActionState,
} from "@/lib/account/types";
import { FormField, FormMessage, FormNotice } from "@/ui/components/address/form-field";
import { SubmitButton } from "@/ui/components/auth/auth-form-parts";

const idleProfile: ProfileActionState = { status: "idle" };
const idlePassword: PasswordActionState = { status: "idle" };

/** First and last name (`accountUpdate`). */
export function EditNameForm({
  action,
  firstName,
  lastName,
}: {
  action: ProfileAction;
  firstName: string;
  lastName: string;
}) {
  const t = useTranslations("account.settings");
  const ta = useTranslations("address.fields");
  const [state, formAction] = useActionState(action, idleProfile);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} noValidate className="space-y-4">
      <h2 className="text-sm font-semibold">{t("nameTitle")}</h2>
      <FormMessage message={state.status === "error" ? state.message : undefined} />
      <FormNotice>{state.status === "success" ? t("nameSaved") : null}</FormNotice>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="firstName"
          label={ta("firstName")}
          autoComplete="given-name"
          defaultValue={state.values?.firstName ?? firstName}
          error={errors?.firstName}
        />
        <FormField
          name="lastName"
          label={ta("lastName")}
          autoComplete="family-name"
          defaultValue={state.values?.lastName ?? lastName}
          error={errors?.lastName}
        />
      </div>
      <div className="max-w-xs">
        <SubmitButton label={t("save")} pendingLabel={t("saving")} />
      </div>
    </form>
  );
}

/** Change password with the current one (`passwordChange`). Passwords are never echoed back. */
export function ChangePasswordForm({ action }: { action: PasswordAction }) {
  const t = useTranslations("account.settings");
  const [state, formAction] = useActionState(action, idlePassword);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} noValidate className="space-y-4">
      <h2 className="text-sm font-semibold">{t("passwordTitle")}</h2>
      <FormMessage message={state.status === "error" ? state.message : undefined} />
      <FormNotice>{state.status === "success" ? t("passwordChanged") : null}</FormNotice>
      <FormField
        name="oldPassword"
        type="password"
        label={t("oldPassword")}
        autoComplete="current-password"
        error={errors?.oldPassword}
      />
      <FormField
        name="password"
        type="password"
        label={t("newPassword")}
        hint={t("passwordHint")}
        autoComplete="new-password"
        error={errors?.password}
      />
      <FormField
        name="confirm"
        type="password"
        label={t("confirmPassword")}
        autoComplete="new-password"
        error={errors?.confirm}
      />
      <div className="max-w-xs">
        <SubmitButton label={t("passwordSubmit")} pendingLabel={t("passwordSaving")} />
      </div>
    </form>
  );
}
