import { type Executor, schema } from "@commerce/db";
import { and, eq, inArray } from "drizzle-orm";
import { hashPassword } from "./password.ts";
import { SESSION_USER_COLUMNS, type SessionUser } from "./sessions.ts";

// Staff account creation from the operator side. Today this is only `pnpm cli createsuperuser`;
// the dashboard's staff-management screens will call the same function later (M1.x). Login and
// sessions live in separate files of this module.

// Light sanity check, deliberately without an email-validation library: it only rejects values
// that can't be delivered to at all. (Saleor uses Django's EmailValidator; we do less.)
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 8 = Django's MinimumLengthValidator as Saleor configures it
// (../saleor-core/saleor/settings.py, AUTH_PASSWORD_VALIDATORS, min_length=8).
// 128 = an upper cap so hashing can never be fed unbounded input.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export type CreateSuperuserInput = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export type CreateSuperuserResult = { id: string; email: string };

// Expected failures of `createSuperuser`, keyed by machine-readable code. Messages never
// mention the password.
export class CreateSuperuserError extends Error {
  readonly code: "INVALID_EMAIL" | "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG" | "EMAIL_TAKEN";

  constructor(code: CreateSuperuserError["code"], message: string) {
    super(message);
    this.name = "CreateSuperuserError";
    this.code = code;
  }
}

export async function createSuperuser(
  db: Executor,
  input: CreateSuperuserInput,
): Promise<CreateSuperuserResult> {
  const email = input.email.trim();
  if (!EMAIL_PATTERN.test(email)) {
    throw new CreateSuperuserError("INVALID_EMAIL", `Invalid email address: ${email}`);
  }

  // Length is checked before hashing: hashing is deliberately expensive, and these failures
  // should be instant.
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new CreateSuperuserError(
      "PASSWORD_TOO_SHORT",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    );
  }
  if (input.password.length > MAX_PASSWORD_LENGTH) {
    throw new CreateSuperuserError(
      "PASSWORD_TOO_LONG",
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`,
    );
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const [created] = await db
      .insert(schema.user)
      .values({
        email,
        passwordHash,
        firstName: input.firstName ?? "",
        lastName: input.lastName ?? "",
        isStaff: true,
        isSuperuser: true,
        isActive: true,
      })
      .returning({ id: schema.user.id, email: schema.user.email });

    if (!created) throw new Error("user insert returned no row"); // practically unreachable
    return created;
  } catch (error) {
    // The DB's `user_email_unique` constraint (on the citext column) is the authority on
    // duplicate emails, also under concurrency. Drizzle wraps the postgres.js error; the
    // constraint name rides on the wrapped error's `cause` (see user.test.ts).
    if (constraintNameOf(error) === "user_email_unique") {
      throw new CreateSuperuserError("EMAIL_TAKEN", "A user with this email already exists.");
    }
    throw error;
  }
}

function constraintNameOf(error: unknown): string | undefined {
  const cause = (error as { cause?: unknown } | null | undefined)?.cause;
  if (typeof cause !== "object" || cause === null) return undefined;
  const name = (cause as { constraint_name?: unknown }).constraint_name;
  return typeof name === "string" ? name : undefined;
}

/** The given users as the API exposes them (no password data). One query for any number of ids. */
export async function getUsersByIds(db: Executor, ids: readonly string[]): Promise<SessionUser[]> {
  if (ids.length === 0) return [];
  return db
    .select(SESSION_USER_COLUMNS)
    .from(schema.user)
    .where(inArray(schema.user.id, [...ids]));
}

/**
 * The id of the active account with this email (case-insensitive: `user.email` is citext), or
 * null. Checkout completion gives a guest checkout to that account (Saleor's assign_checkout_user).
 */
export async function getActiveUserIdByEmail(db: Executor, email: string): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(eq(schema.user.email, email.trim()), eq(schema.user.isActive, true)));
  return row?.id ?? null;
}
