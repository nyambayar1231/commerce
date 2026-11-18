import { type CountryCode, isCountryCode } from "./countries.ts";

// Saleor's AddressInput / Address (saleor/account/models.py, saleor/graphql/account/i18n.py),
// reduced to PLAN M5 decision 3: required fields and a known country code. Saleor also validates
// postal codes, country areas and phone numbers per country with Google's i18naddress data; we
// don't (no new dependency). Checkout stores the cleaned address as a JSON snapshot
// (ARCHITECTURE §3), so later edits elsewhere never change it.

export type AddressType = "SHIPPING" | "BILLING";

/** A stored address: every text field present (empty string when not given), as Saleor's model. */
export type Address = {
  firstName: string;
  lastName: string;
  companyName: string;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  cityArea: string;
  postalCode: string;
  country: CountryCode;
  countryArea: string;
  phone: string;
};

export type AddressInput = Partial<Record<Exclude<keyof Address, "country">, string | null>> & {
  country?: string | null;
};

export type AddressError = {
  field: keyof Address;
  code: "REQUIRED" | "INVALID";
  message: string;
};

const TEXT_FIELDS = [
  "firstName",
  "lastName",
  "companyName",
  "streetAddress1",
  "streetAddress2",
  "city",
  "cityArea",
  "postalCode",
  "countryArea",
  "phone",
] as const;

// Saleor's Address model column lengths (saleor/account/models.py).
const MAX_LENGTH: Record<(typeof TEXT_FIELDS)[number], number> = {
  firstName: 256,
  lastName: 256,
  companyName: 256,
  streetAddress1: 256,
  streetAddress2: 256,
  city: 256,
  cityArea: 128,
  postalCode: 20,
  countryArea: 128,
  phone: 128,
};

const REQUIRED: readonly (keyof Address)[] = [
  "firstName",
  "lastName",
  "streetAddress1",
  "city",
  "country",
];

const MESSAGES = {
  required: "This field is required.",
  tooLong: (max: number) => `Ensure this value has at most ${max} characters.`,
  country: "Invalid country code.",
};

/**
 * Trims every field, then checks required fields, lengths and the country code. Returns every
 * error at once (Saleor reports all invalid fields together).
 */
export function cleanAddress(
  input: AddressInput,
): { ok: true; address: Address } | { ok: false; errors: AddressError[] } {
  const errors: AddressError[] = [];
  const text = {} as Record<(typeof TEXT_FIELDS)[number], string>;

  for (const field of TEXT_FIELDS) {
    const value = (input[field] ?? "").trim();
    text[field] = value;
    if (value.length > MAX_LENGTH[field]) {
      errors.push({ field, code: "INVALID", message: MESSAGES.tooLong(MAX_LENGTH[field]) });
    }
  }

  const country = (input.country ?? "").trim().toUpperCase();

  for (const field of REQUIRED) {
    const value = field === "country" ? country : text[field as (typeof TEXT_FIELDS)[number]];
    if (value === "") errors.push({ field, code: "REQUIRED", message: MESSAGES.required });
  }
  if (country !== "" && !isCountryCode(country)) {
    errors.push({ field: "country", code: "INVALID", message: MESSAGES.country });
  }

  if (errors.length > 0 || !isCountryCode(country)) return { ok: false, errors };
  return { ok: true, address: { ...text, country } };
}

/** A stored JSON snapshot back as an Address; anything else is corrupt data, never guessed at. */
export function parseStoredAddress(value: unknown): Address | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new Error("checkout address is not an object");
  const record = value as Record<string, unknown>;
  const country = record.country;
  if (typeof country !== "string" || !isCountryCode(country)) {
    throw new Error("checkout address has no valid country");
  }
  const text = {} as Record<(typeof TEXT_FIELDS)[number], string>;
  for (const field of TEXT_FIELDS) {
    const fieldValue = record[field];
    text[field] = typeof fieldValue === "string" ? fieldValue : "";
  }
  return { ...text, country };
}
