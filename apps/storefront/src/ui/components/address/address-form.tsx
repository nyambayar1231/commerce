"use client";

// Adapted from saleor-storefront: src/ui/components/account/address-form-dialog.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import { type FormEvent, useActionState, useEffect, useState } from "react";
import type {
  AddressAction,
  AddressActionState,
  AddressView,
  CountryOption,
} from "@/lib/account/types";
import { SubmitButton } from "@/ui/components/auth/auth-form-parts";
import { clientAddressErrors, readAddressForm } from "./address-errors";
import { AddressFields, type FieldErrors } from "./address-fields";
import { FormMessage } from "./form-field";

const idle: AddressActionState = { status: "idle" };

/**
 * The address form (ARCHITECTURE §10.9): the shared `AddressFields` in a form of its own. The
 * address rules of `@commerce/contracts` run in the browser before the submit; the Server Action
 * and the API stay authoritative and their field errors come back through `state`. `onDone` runs
 * after a successful save. The account dialog shows "Save" and "Cancel"; the checkout names its
 * own button (`submitLabel`) and has nothing to cancel (no `onCancel`).
 */
export function AddressForm({
  action,
  countries,
  address,
  onDone,
  onCancel,
  submitLabel,
  pendingLabel,
}: {
  action: AddressAction;
  countries: CountryOption[];
  /** The address being edited or prefilled; none for a new one. */
  address?: AddressView;
  onDone: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  const t = useTranslations("address");
  const [state, formAction] = useActionState(action, idle);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  const fieldErrors: FieldErrors =
    clientErrors ?? (state.status === "error" ? (state.fieldErrors ?? {}) : {});
  const message = clientErrors === null && state.status === "error" ? state.message : undefined;

  // A form with errors never reaches the Server Action: React skips a prevented submit.
  const validate = (event: FormEvent<HTMLFormElement>) => {
    const errors = clientAddressErrors(readAddressForm(new FormData(event.currentTarget)));
    setClientErrors(errors);
    if (errors) event.preventDefault();
  };

  return (
    <form action={formAction} onSubmit={validate} noValidate className="space-y-4">
      <FormMessage message={message} />
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      <AddressFields
        countries={countries}
        address={address}
        submitted={state.values}
        errors={fieldErrors}
      />
      <div className="flex gap-3 pt-2">
        <SubmitButton
          label={submitLabel ?? t("book.save")}
          pendingLabel={pendingLabel ?? t("book.saving")}
        />
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-12 shrink-0 rounded-button border border-input px-6 text-base font-medium hover:bg-accent"
          >
            {t("book.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
