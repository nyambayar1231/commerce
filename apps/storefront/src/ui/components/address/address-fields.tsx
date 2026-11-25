"use client";

// Adapted from saleor-storefront: src/ui/components/account/address-form-dialog.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { useTranslations } from "next-intl";
import type {
  AccountErrorKey,
  AddressField,
  AddressView,
  CountryOption,
} from "@/lib/account/types";
import { FormField, inputClassName } from "./form-field";

export type FieldErrors = Partial<Record<AddressField, AccountErrorKey>>;

/**
 * The address fields, ordered for Mongolia (ARCHITECTURE §10.9): country (Mongolia preselected),
 * aimag or capital → `countryArea`, sum or district → `city`, bag or khoroo → `cityArea`, then
 * street, building and apartment → `streetAddress1`. No `<form>` and no buttons, so the account
 * dialog and the checkout (shipping and billing) share it. `prefix` namespaces the DOM ids when
 * a page shows two address forms.
 */
export function AddressFields({
  countries,
  address,
  submitted,
  errors,
}: {
  countries: CountryOption[];
  /** The address being edited or prefilled; none for a new one. */
  address?: AddressView;
  /** What was submitted last, kept after an error. */
  submitted?: Partial<Record<AddressField, string>>;
  errors: FieldErrors;
}) {
  const t = useTranslations("address");

  const initial = (field: AddressField): string => {
    const value = submitted?.[field];
    if (value !== undefined) return value;
    if (field === "country") return address?.countryCode ?? defaultCountry(countries);
    return address?.[field] ?? "";
  };

  const text = (field: AddressField, extra: Record<string, string> = {}) => ({
    name: field,
    label: t(`fields.${field}`),
    defaultValue: initial(field),
    error: errors[field],
    ...extra,
  });

  return (
    <>
      {address ? (
        <input type="hidden" name="companyName" defaultValue={initial("companyName")} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField {...text("firstName", { autoComplete: "given-name" })} />
        <FormField {...text("lastName", { autoComplete: "family-name" })} />
      </div>
      <FormField name="country" label={t("fields.country")} error={errors.country}>
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
    </>
  );
}

/** Mongolia when the shop sells there (the storefront's market), else the first country. */
function defaultCountry(countries: CountryOption[]): string {
  return countries.some((country) => country.code === "MN") ? "MN" : (countries[0]?.code ?? "MN");
}
