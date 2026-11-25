import { cleanAddress } from "@commerce/contracts";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/validation";
import type { AccountErrorKey, AddressField, PasswordField, ProfileField } from "./types";

// Server-side checks for the account forms. The browser runs the address rules too
// (src/ui/components/address/address-errors.ts) for instant errors; these are the authority
// before the API's own checks.

type Errors<Field extends string> = Partial<Record<Field, AccountErrorKey>>;

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

const MAX_NAME_LENGTH = 256;

function compact<Field extends string>(errors: Errors<Field>): Errors<Field> | null {
  return Object.values(errors).some(Boolean) ? errors : null;
}

/** Every address field of the form as a string; a missing field is "". */
export function readAddressValues(formData: FormData): Record<AddressField, string> {
  const values = {} as Record<AddressField, string>;
  for (const field of ADDRESS_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/** `cleanAddress` (the API's rules) as field error keys. Null when the address is fine. */
export function validateAddress(values: Record<AddressField, string>): Errors<AddressField> | null {
  const result = cleanAddress(values);
  if (result.ok) return null;
  const errors: Errors<AddressField> = {};
  for (const error of result.errors) {
    errors[error.field] =
      error.code === "REQUIRED" ? "required" : error.field === "country" ? "invalid" : "tooLong";
  }
  return errors;
}

/** The API's address error codes mapped back to the form's fields; unknown fields are not lost. */
export function addressErrorsFromApi(errors: readonly { code: string; field: string | null }[]): {
  fieldErrors: Errors<AddressField>;
  message?: AccountErrorKey;
} {
  const fieldErrors: Errors<AddressField> = {};
  let message: AccountErrorKey | undefined;
  for (const { code, field } of errors) {
    if (code === "NOT_FOUND") {
      message = "notFound";
    } else if (field !== null && (ADDRESS_FIELDS as readonly string[]).includes(field)) {
      fieldErrors[field as AddressField] = code === "REQUIRED" ? "required" : "invalid";
    } else {
      message ??= "generic";
    }
  }
  return { fieldErrors, message };
}

export function validateProfile(values: Record<ProfileField, string>): Errors<ProfileField> | null {
  return compact<ProfileField>({
    firstName: values.firstName.length > MAX_NAME_LENGTH ? "tooLong" : undefined,
    lastName: values.lastName.length > MAX_NAME_LENGTH ? "tooLong" : undefined,
  });
}

export function validatePasswordChange(
  input: Record<PasswordField, string>,
): Errors<PasswordField> | null {
  return compact<PasswordField>({
    oldPassword: input.oldPassword === "" ? "passwordRequired" : undefined,
    password:
      input.password === ""
        ? "passwordRequired"
        : input.password.length < MIN_PASSWORD_LENGTH
          ? "passwordTooShort"
          : undefined,
    confirm: input.password !== input.confirm ? "passwordsMismatch" : undefined,
  });
}
