import { cleanAddress } from "@commerce/contracts";
import type { AccountErrorKey, AddressField } from "@/lib/account/types";

/** The form's address fields, in the order the form shows them. */
export const ADDRESS_FIELDS: readonly AddressField[] = [
  "firstName",
  "lastName",
  "companyName",
  "country",
  "countryArea",
  "city",
  "cityArea",
  "streetAddress1",
  "streetAddress2",
  "postalCode",
  "phone",
];

/** Every address field of a form as a string; a missing or non-text field is "". */
export function readAddressForm(formData: FormData): Record<AddressField, string> {
  const values = {} as Record<AddressField, string>;
  for (const field of ADDRESS_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/**
 * The same rules the API applies (`cleanAddress`), run in the browser for instant errors, as keys
 * of the `errors` message namespace per form field. Null when the address is fine. The Server
 * Action runs them again: the API stays authoritative.
 */
export function clientAddressErrors(
  values: Record<AddressField, string>,
): Partial<Record<AddressField, AccountErrorKey>> | null {
  const result = cleanAddress(values);
  if (result.ok) return null;
  const errors: Partial<Record<AddressField, AccountErrorKey>> = {};
  for (const error of result.errors) {
    errors[error.field] =
      error.code === "REQUIRED" ? "required" : error.field === "country" ? "invalid" : "tooLong";
  }
  return errors;
}
