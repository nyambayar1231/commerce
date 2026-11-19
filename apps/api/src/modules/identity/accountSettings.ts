// Adapted from saleor-core: saleor/graphql/account/mutations/account/account_update.py and
// saleor/graphql/account/mutations/authentication/password_change.py
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The storefront's account settings page (M15.2): a logged-in user changes their own first and
// last name (Saleor's AccountUpdate) and their password (Saleor's PasswordChange).
import { type Executor, schema, type Tx } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { validateNewPassword } from "./accounts.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { revokeOtherUserSessions, SESSION_USER_COLUMNS, type SessionUser } from "./sessions.ts";

// Saleor's `account.User.first_name`/`last_name` are Django CharFields with max_length=256.
export const MAX_NAME_LENGTH = 256;

// As login.ts: longer input can't match the stored hash, so it is never hashed.
const MAX_PASSWORD_LENGTH = 128;

export type AccountSettingsError = {
  field: "firstName" | "lastName" | "oldPassword" | "newPassword";
  code: "INVALID" | "INVALID_CREDENTIALS" | "PASSWORD_TOO_SHORT";
  message: string;
};

// Django's messages for these validators.
const MESSAGES = {
  nameTooLong: `Ensure this value has at most ${MAX_NAME_LENGTH} characters.`,
  // Saleor's PasswordChange.raise_invalid_credentials.
  invalidOldPassword: "Old password isn't valid.",
} as const;

export type AccountUpdateResult =
  | { ok: true; user: SessionUser }
  | { ok: false; errors: AccountSettingsError[] };

/**
 * Saleor's AccountUpdate, limited to the names: a field left out (or null) keeps its value, a given
 * value is trimmed and stored (an empty string clears it). Setting `updated_at` happens with the
 * change, as Saleor's save does.
 */
export async function updateAccount(
  db: Executor,
  userId: string,
  input: { firstName?: string | null; lastName?: string | null },
): Promise<AccountUpdateResult> {
  const changes: { firstName?: string; lastName?: string } = {};
  const errors: AccountSettingsError[] = [];
  for (const field of ["firstName", "lastName"] as const) {
    const value = input[field];
    if (value == null) continue;
    const trimmed = value.trim();
    if (trimmed.length > MAX_NAME_LENGTH) {
      errors.push({ field, code: "INVALID", message: MESSAGES.nameTooLong });
    } else {
      changes[field] = trimmed;
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const [user] = await db
    .update(schema.user)
    .set({ ...changes, updatedAt: sql`now()` })
    .where(eq(schema.user.id, userId))
    .returning(SESSION_USER_COLUMNS);
  if (!user) throw new Error(`user ${userId} vanished`);
  return { ok: true, user };
}

export type PasswordChangeResult =
  | { ok: true; user: SessionUser }
  | { ok: false; errors: AccountSettingsError[] };

// Verified against when there is no old password to check (missing, or an account without one), so
// those answers take as long as a wrong password and don't reveal which they were. Made once, as
// login.ts makes its own.
let dummyHash: Promise<string> | undefined;

/**
 * Saleor's PasswordChange: checks the old password against the locked row, validates the new one
 * and stores its hash, then ends every other session of the user, keeping the request's own
 * (`keepSessionToken`). A new password usually means the old one may be known, so the other
 * devices are signed out; the caller stays logged in where they are.
 */
export async function changePassword(
  tx: Tx,
  userId: string,
  keepSessionToken: string,
  input: { oldPassword?: string | null; newPassword: string },
): Promise<PasswordChangeResult> {
  const [row] = await tx
    .select({ ...SESSION_USER_COLUMNS, passwordHash: schema.user.passwordHash })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .for("update");
  if (!row) throw new Error(`user ${userId} vanished`);
  const passwordHash = row.passwordHash;

  const oldPassword = input.oldPassword;
  let correct = false;
  if (oldPassword != null && passwordHash !== null && oldPassword.length <= MAX_PASSWORD_LENGTH) {
    correct = await verifyPassword(passwordHash, oldPassword);
  } else {
    dummyHash ??= hashPassword("dummy password for timing");
    await verifyPassword(await dummyHash, oldPassword ?? "");
  }
  if (!correct) {
    return {
      ok: false,
      errors: [
        {
          field: "oldPassword",
          code: "INVALID_CREDENTIALS",
          message: MESSAGES.invalidOldPassword,
        },
      ],
    };
  }

  const passwordError = validateNewPassword(input.newPassword);
  if (passwordError) {
    return {
      ok: false,
      errors: [{ field: "newPassword", code: passwordError.code, message: passwordError.message }],
    };
  }

  // Hashed after both checks, inside the transaction: the row stays locked from the old-password
  // check to the update, so nothing can change underneath it.
  const passwordHashNext = await hashPassword(input.newPassword);
  const [updated] = await tx
    .update(schema.user)
    .set({ passwordHash: passwordHashNext, updatedAt: sql`now()` })
    .where(eq(schema.user.id, userId))
    .returning(SESSION_USER_COLUMNS);
  if (!updated) throw new Error(`user ${userId} vanished`);
  await revokeOtherUserSessions(tx, userId, keepSessionToken);
  return { ok: true, user: updated };
}
