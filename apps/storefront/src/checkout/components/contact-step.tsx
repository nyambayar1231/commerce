"use client";

// Adapted from saleor-storefront: src/checkout/components/contact/{guest-contact,signed-in-user}.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, SubmitButton } from "@/ui/components/auth/auth-form-parts";
import type { CheckoutSession, ContactAction, ContactActionState } from "../types";
import { StepMessage } from "./step-message";

const idle: ContactActionState = { status: "idle" };

/**
 * Contact (ARCHITECTURE §10.9): a signed-in customer's email is used as is (the Server Action
 * reads it from the session, not from this form); a guest types one or signs in and comes back.
 */
export function ContactStep({
  session,
  email,
  setEmail,
  logout,
}: {
  session: CheckoutSession;
  /** The email already on the checkout, for a guest coming back to this step. */
  email: string | null;
  setEmail: ContactAction;
  logout: () => Promise<void>;
}) {
  const t = useTranslations("checkout.contact");
  const tAuth = useTranslations("auth");
  const [state, formAction] = useActionState(setEmail, idle);
  const signedIn = session.status === "authenticated";

  return (
    <section aria-labelledby="checkout-contact-title" className="space-y-4">
      <h1 id="checkout-contact-title" className="text-2xl font-semibold">
        {t("title")}
      </h1>

      {signedIn ? (
        <div className="space-y-4">
          <p className="text-sm">
            {t("signedInAs", { email: session.email })}{" "}
            <button
              type="button"
              onClick={() => logout()}
              className="text-muted-foreground underline underline-offset-2"
            >
              {t("notYou")}
            </button>
          </p>
          <form action={formAction} className="space-y-4">
            <StepMessage message={state.message} />
            <SubmitButton label={t("continue")} pendingLabel={t("continuing")} />
          </form>
        </div>
      ) : (
        <form action={formAction} noValidate className="space-y-4">
          <StepMessage message={state.message} />
          <Field
            name="email"
            type="email"
            icon="mail"
            placeholder={tAuth("placeholders.email")}
            label={t("email")}
            hint={t("emailHint")}
            autoComplete="email"
            defaultValue={state.values?.email ?? email ?? ""}
            error={state.fieldErrors?.email}
          />
          <SubmitButton label={t("continue")} pendingLabel={t("continuing")} />
          <p className="text-center text-sm text-muted-foreground">
            {t("haveAccount")}{" "}
            <Link
              href="/login?next=/checkout"
              className="font-medium text-foreground underline underline-offset-2"
            >
              {t("signIn")}
            </Link>
          </p>
        </form>
      )}
    </section>
  );
}
