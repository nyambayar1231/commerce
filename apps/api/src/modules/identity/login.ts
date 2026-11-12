import { type Executor, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./password.ts";
import { SESSION_USER_COLUMNS, type SessionUser } from "./sessions.ts";

// Password login, as Saleor's `tokenCreate` decides it
// (../saleor-core/saleor/graphql/account/mutations/authentication/create_token.py): unknown email,
// missing password and wrong password all fail the same way; `INACTIVE` is only reported once the
// password is right. Rate limiting is deferred to M9 (ARCHITECTURE.md §7).

// Same cap as account creation (users.ts): longer input can't match and is never hashed.
const MAX_PASSWORD_LENGTH = 128;

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; code: "INVALID_CREDENTIALS" | "INACTIVE" };

// Verified against when the email is unknown or has no password, so those answers take as long
// as a wrong password and don't reveal which emails exist. Made once, on first use.
let dummyHash: Promise<string> | undefined;

export async function authenticate(
  db: Executor,
  email: string,
  password: string,
): Promise<LoginResult> {
  if (password.length > MAX_PASSWORD_LENGTH) return { ok: false, code: "INVALID_CREDENTIALS" };

  const [row] = await db
    .select({ ...SESSION_USER_COLUMNS, passwordHash: schema.user.passwordHash })
    .from(schema.user)
    .where(eq(schema.user.email, email.trim()));

  if (!row?.passwordHash) {
    dummyHash ??= hashPassword("dummy password for timing");
    await verifyPassword(await dummyHash, password);
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }
  if (!(await verifyPassword(row.passwordHash, password))) {
    return { ok: false, code: "INVALID_CREDENTIALS" };
  }
  if (!row.isActive) return { ok: false, code: "INACTIVE" };

  // Saleor's update_user_last_login_if_required, on every successful login.
  const { passwordHash: _p, ...user } = row;
  const [updated] = await db
    .update(schema.user)
    .set({ lastLogin: sql`now()` })
    .where(eq(schema.user.id, row.id))
    .returning({ lastLogin: schema.user.lastLogin });
  return { ok: true, user: { ...user, lastLogin: updated?.lastLogin ?? user.lastLogin } };
}
