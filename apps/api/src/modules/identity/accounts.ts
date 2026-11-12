import { type Executor, schema } from "@commerce/db";
import { hashPassword } from "./password.ts";
import { EMAIL_PATTERN } from "./users.ts";

// Customer self-registration: Saleor's accountRegister
// (../saleor-core/saleor/graphql/account/mutations/account/account_register.py) with email
// confirmation turned off (PLAN M7 decision 1), so the account is active and can log in at once.
//
// As Saleor, the answer never says whether the email was already registered (that would let anyone
// enumerate accounts): an existing email gets the same success, and nothing is created or changed.
// The password is hashed in both cases so the timing doesn't tell either. Validation errors are
// about the input only. Linking the email's guest orders is the orders module's job; the caller
// does it in the same transaction when a user was created.

// Saleor's MinimumLengthValidator (settings.py AUTH_PASSWORD_VALIDATORS, min_length=8); 128 is our
// cap so hashing is never fed unbounded input (as users.ts).
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export type AccountRegisterInput = {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type AccountRegisterErrorCode = "INVALID" | "PASSWORD_TOO_SHORT" | "REQUIRED";

export type AccountRegisterError = {
  field: "email" | "password";
  code: AccountRegisterErrorCode;
  message: string;
};

export type AccountRegisterResult =
  // `userId` is null when the email was already taken (not reported to the caller's client).
  | { ok: true; userId: string | null; email: string }
  | { ok: false; errors: AccountRegisterError[] };

// Django's messages for these validators.
const MESSAGES = {
  required: "This field is required.",
  invalidEmail: "Enter a valid email address.",
  passwordTooShort: `This password is too short. It must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
  passwordTooLong: `Ensure this value has at most ${MAX_PASSWORD_LENGTH} characters.`,
} as const;

/** Checks the input; the email is trimmed and lower-cased as Saleor does. */
export function cleanAccountRegisterInput(
  input: AccountRegisterInput,
): { ok: true; email: string } | { ok: false; errors: AccountRegisterError[] } {
  const errors: AccountRegisterError[] = [];
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
  return errors.length > 0 ? { ok: false, errors } : { ok: true, email };
}

/**
 * Creates an active customer (not staff) with the given password, unless the email is taken.
 * The hash is computed before any row is touched, so callers can run this inside a short
 * transaction; `ON CONFLICT DO NOTHING` makes two concurrent registrations of one email safe.
 */
export async function registerCustomer(
  db: Executor,
  input: AccountRegisterInput,
  passwordHash: string,
): Promise<AccountRegisterResult> {
  const cleaned = cleanAccountRegisterInput(input);
  if (!cleaned.ok) return cleaned;
  const [created] = await db
    .insert(schema.user)
    .values({
      email: cleaned.email,
      passwordHash,
      firstName: input.firstName?.trim() ?? "",
      lastName: input.lastName?.trim() ?? "",
      isStaff: false,
      isActive: true,
    })
    .onConflictDoNothing({ target: schema.user.email })
    .returning({ id: schema.user.id });
  return { ok: true, userId: created?.id ?? null, email: cleaned.email };
}

/**
 * The argon2id hash for a registration, computed after validation and outside any transaction
 * (hashing is slow). Taken and free emails both pay for it.
 */
export const hashRegistrationPassword = (password: string): Promise<string> =>
  hashPassword(password);
