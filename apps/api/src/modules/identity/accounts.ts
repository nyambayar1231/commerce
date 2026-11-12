import { type Executor, schema } from "@commerce/db";
import { validateRedirectUrl } from "./confirmation.ts";
import { hashPassword } from "./password.ts";
import { EMAIL_PATTERN } from "./users.ts";

// Customer self-registration: Saleor's accountRegister
// (../saleor-core/saleor/graphql/account/mutations/account/account_register.py) with email
// confirmation on (PLAN M8 decision 3): the account is created unconfirmed and can't log in until
// confirmAccount; the caller adds the confirmation email job in the same transaction.
//
// As Saleor, the answer never says whether the email was already registered (that would let anyone
// enumerate accounts): an existing email gets the same success, and nothing is created, changed or
// sent. The password is hashed in both cases so the timing doesn't tell either. Validation errors
// are about the input only. Guest orders are linked when the account is confirmed, not here
// (decision 4), so an unconfirmed email can't claim anyone's orders.

// Saleor's MinimumLengthValidator (settings.py AUTH_PASSWORD_VALIDATORS, min_length=8); 128 is our
// cap so hashing is never fed unbounded input (as users.ts).
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export type AccountRegisterInput = {
  email: string;
  password: string;
  /** Where the confirmation link points (the storefront's confirm page). */
  redirectUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type AccountRegisterErrorCode = "INVALID" | "PASSWORD_TOO_SHORT" | "REQUIRED";

export type AccountRegisterError = {
  field: "email" | "password" | "redirectUrl";
  code: AccountRegisterErrorCode;
  message: string;
};

// Django's messages for these validators.
const MESSAGES = {
  required: "This field is required.",
  invalidEmail: "Enter a valid email address.",
  passwordTooShort: `This password is too short. It must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
  passwordTooLong: `Ensure this value has at most ${MAX_PASSWORD_LENGTH} characters.`,
} as const;

/**
 * Checks the input; the email is trimmed and lower-cased as Saleor does. `redirectUrl` is required
 * and must be on an allowed host (Saleor's clean_redirect_url).
 */
export function cleanAccountRegisterInput(
  input: AccountRegisterInput,
  allowedHosts: readonly string[],
):
  | { ok: true; email: string; redirectUrl: string }
  | { ok: false; errors: AccountRegisterError[] } {
  const errors: AccountRegisterError[] = [];
  const redirectUrl = input.redirectUrl?.trim() ?? "";
  if (redirectUrl === "") {
    errors.push({ field: "redirectUrl", code: "REQUIRED", message: MESSAGES.required });
  } else {
    const invalid = validateRedirectUrl(redirectUrl, allowedHosts);
    if (invalid) errors.push({ field: "redirectUrl", code: "INVALID", message: invalid });
  }
  const email = input.email.trim().toLowerCase();
  if (email === "") {
    errors.push({ field: "email", code: "REQUIRED", message: MESSAGES.required });
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.push({ field: "email", code: "INVALID", message: MESSAGES.invalidEmail });
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: "password",
      code: "PASSWORD_TOO_SHORT",
      message: MESSAGES.passwordTooShort,
    });
  } else if (input.password.length > MAX_PASSWORD_LENGTH) {
    errors.push({ field: "password", code: "INVALID", message: MESSAGES.passwordTooLong });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, email, redirectUrl };
}

/**
 * Creates an active, unconfirmed customer (not staff) with the given password, unless the email is
 * taken. `email` comes cleaned from cleanAccountRegisterInput. The hash is computed before any row
 * is touched, so callers can run this inside a short transaction; `ON CONFLICT DO NOTHING` makes
 * two concurrent registrations of one email safe. Returns the new user's id, or null when the
 * email was taken (not reported to the caller's client).
 */
export async function registerCustomer(
  db: Executor,
  input: Pick<AccountRegisterInput, "firstName" | "lastName"> & { email: string },
  passwordHash: string,
): Promise<string | null> {
  const [created] = await db
    .insert(schema.user)
    .values({
      email: input.email,
      passwordHash,
      firstName: input.firstName?.trim() ?? "",
      lastName: input.lastName?.trim() ?? "",
      isStaff: false,
      isActive: true,
      isConfirmed: false,
    })
    .onConflictDoNothing({ target: schema.user.email })
    .returning({ id: schema.user.id });
  return created?.id ?? null;
}

/**
 * The argon2id hash for a registration, computed after validation and outside any transaction
 * (hashing is slow). Taken and free emails both pay for it.
 */
export const hashRegistrationPassword = (password: string): Promise<string> =>
  hashPassword(password);
