"use client";

// Adapted from saleor-storefront: src/ui/components/account/address-form-dialog.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import { type FormEvent, useActionState, useEffect, useState } from "react";
import type {
  AccountErrorKey,
  AddressAction,
  AddressActionState,
  AddressField,
  AddressView,
  CountryOption,
} from "@/lib/account/types";
import { SubmitButton } from "@/ui/components/auth/auth-form-parts";
import { clientAddressErrors, readAddressForm } from "./address-errors";
import { FormField, FormMessage, inputClassName } from "./form-field";

const idle: AddressActionState = { status: "idle" };

type FieldErrors = Partial<Record<AddressField, AccountErrorKey>>;

/**
 * The address form, ordered for Mongolia (ARCHITECTURE §10.9): country (Mongolia preselected),
 * aimag or capital → `countryArea`, sum or district → `city`, bag or khoroo → `cityArea`, then
 * street, building and apartment → `streetAddress1`. The address rules of `@commerce/contracts`
 * run in the browser before the submit; the Server Action and the API stay authoritative and
 * their field errors come back through `state`. `onDone` runs after a successful save.
 */
export function AddressForm({
  action,
  countries,
  address,
  onDone,
  onCancel,
}: {
  action: AddressAction;
  countries: CountryOption[];
  /** The address being edited; none for a new one. */
  address?: AddressView;
  onDone: () => void;
  onCancel: () => void;
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

  const initial = (field: AddressField): string => {
    const submitted = state.values?.[field];
    if (submitted !== undefined) return submitted;
    if (field === "country") return address?.countryCode ?? defaultCountry(countries);
    return address?.[field] ?? "";
  };

  // A form with errors never reaches the Server Action: React skips a prevented submit.
  const validate = (event: FormEvent<HTMLFormElement>) => {
    const errors = clientAddressErrors(readAddressForm(new FormData(event.currentTarget)));
    setClientErrors(errors);
    if (errors) event.preventDefault();
  };

  const text = (field: AddressField, extra: Record<string, string> = {}) => ({
    name: field,
    label: t(`fields.${field}`),
    defaultValue: initial(field),
    error: fieldErrors[field],
    ...extra,
  });

  return (
    <form action={formAction} onSubmit={validate} noValidate className="space-y-4">
      <FormMessage message={message} />
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      {address ? (
        <input type="hidden" name="companyName" defaultValue={initial("companyName")} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField {...text("firstName", { autoComplete: "given-name" })} />
        <FormField {...text("lastName", { autoComplete: "family-name" })} />
      </div>
      <FormField name="country" label={t("fields.country")} error={fieldErrors.country}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="country"
            defaultValue={initial("country")}
            autoComplete="country"
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            className={inputClassName}
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField {...text("countryArea", { autoComplete: "address-level1" })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField {...text("city", { autoComplete: "address-level2" })} />
        <FormField {...text("cityArea", { autoComplete: "address-level3" })} />
      </div>
      <FormField {...text("streetAddress1", { autoComplete: "address-line1" })} />
      <FormField {...text("streetAddress2", { autoComplete: "address-line2" })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField {...text("postalCode", { autoComplete: "postal-code" })} />
        <FormField {...text("phone", { autoComplete: "tel", type: "tel" })} />
      </div>
      <div className="flex gap-3 pt-2">
        <SubmitButton label={t("book.save")} pendingLabel={t("book.saving")} />
        <button
          type="button"
          onClick={onCancel}
          className="h-12 shrink-0 rounded-button border border-input px-6 text-base font-medium hover:bg-accent"
        >
          {t("book.cancel")}
        </button>
      </div>
    </form>
  );
}

/** Mongolia when the shop sells there (the storefront's market), else the first country. */
function defaultCountry(countries: CountryOption[]): string {
  return countries.some((country) => country.code === "MN") ? "MN" : (countries[0]?.code ?? "MN");
}
