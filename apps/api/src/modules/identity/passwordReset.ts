// Adapted from saleor-core: saleor/graphql/account/mutations/authentication/request_password_reset.py,
// saleor/graphql/account/mutations/authentication/set_password.py, saleor/account/tasks.py
// (trigger_send_password_reset_notification), saleor/account/notifications.py
// (send_password_reset_notification) and plugins/user_email/default_email_templates/password_reset.html
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Password reset (M15.1): requestPasswordReset emails a link to `redirectUrl?email=…&token=…`
// (the storefront's page, M4); that page calls setPassword(email, token, password). The token is
// made by the worker when it sends, as for account confirmation, and hashes the password hash,
// last login and confirmation state, so it works once.
import { schema, type Tx } from "@commerce/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { defineJobHandler, defineQueue, type EmailMessage, enqueue } from "../jobs/index.ts";
import { matchOrdersWithNewUser } from "../orders/index.ts";
import { getShop } from "../shop/index.ts";
import { validateNewPassword } from "./accounts.ts";
import { confirmationUrl } from "./confirmation.ts";
import { hashPassword } from "./password.ts";
import { type CreatedSession, createSession, revokeUserSessions } from "./sessions.ts";
import { checkToken, makeToken, PASSWORD_RESET_SALT, readSecretKey } from "./tokens.ts";

// Saleor's settings.RESET_PASSWORD_LOCK_TIME: a second reset email for the same account is sent
// at most 15 minutes after the last one, so the button can't be used to flood someone's inbox.
export const RESET_PASSWORD_LOCK_TIME_SECONDS = 900;

export const passwordResetQueue = defineQueue<{ userId: string; redirectUrl: string }>(
  "password-reset-email",
);

/**
 * Saleor's RequestPasswordReset.clean_user: claims the right to send an email with one conditional
 * update, so two concurrent requests send at most one email (the row only matches when it was
 * never reset or the last one is older than the lock time). Unknown, inactive and rate-limited
 * emails simply match no row. Returns whether a job was added; the caller never tells the client,
 * so emails can't be enumerated. `email` is normalized here as Saleor does.
 */
export async function requestPasswordReset(
  tx: Tx,
  email: string,
  redirectUrl: string,
): Promise<boolean> {
  const [user] = await tx
    .update(schema.user)
    .set({ lastPasswordResetRequest: sql`now()` })
    .where(
      and(
        eq(schema.user.email, email.trim().toLowerCase()),
        eq(schema.user.isActive, true),
        or(
          isNull(schema.user.lastPasswordResetRequest),
          sql`${schema.user.lastPasswordResetRequest} < now() - make_interval(secs => ${RESET_PASSWORD_LOCK_TIME_SECONDS})`,
        ),
      ),
    )
    .returning({ id: schema.user.id });
  if (!user) return false;
  await enqueue(tx, passwordResetQueue, { userId: user.id, redirectUrl });
  return true;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Saleor's password_reset.html, as plain text and simple HTML (as renderAccountConfirmation). */
export function renderPasswordReset(resetUrl: string, shopName: string): Omit<EmailMessage, "to"> {
  const intro = `You're receiving this e-mail because you or someone else has requested a password for your user account at ${shopName}. It can be safely ignored if you did not request a password reset. Click the link below to reset your password.`;
  const notice = "This is an automatically generated e-mail, please do not reply.";
  return {
    subject: "Password reset e-mail",
    text: ["Hi!", "", intro, "", resetUrl, "", notice, "", `Sincerely, ${shopName}`].join("\n"),
    html: `<!doctype html>
<html>
<body style="font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #000;">
<p>Hi!</p>
<p>${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
<p>${escapeHtml(notice)}</p>
<p style="text-align: center;">Sincerely, ${escapeHtml(shopName)}</p>
</body>
</html>`,
  };
}

const TOKEN_COLUMNS = {
  id: schema.user.id,
  email: schema.user.email,
  passwordHash: schema.user.passwordHash,
  lastLogin: schema.user.lastLogin,
  isConfirmed: schema.user.isConfirmed,
};

/** The worker's handler: makes the token and emails the link, unless there's no one to email. */
export const passwordResetHandler = defineJobHandler(
  passwordResetQueue,
  async ({ userId, redirectUrl }, { db, mailer }) => {
    const [user] = await db
      .select({ ...TOKEN_COLUMNS, isActive: schema.user.isActive })
      .from(schema.user)
      .where(eq(schema.user.id, userId));
    // Deleted or deactivated meanwhile: finishing the job without an email is right.
    if (!user?.isActive) return;
    const token = makeToken(user, PASSWORD_RESET_SALT, readSecretKey());
    const shop = await getShop(db);
    await mailer.send({
      to: user.email,
      ...renderPasswordReset(confirmationUrl(redirectUrl, user.email, token), shop.name),
    });
  },
);

export type SetPasswordResult =
  | { ok: true; userId: string; session: CreatedSession }
  | {
      ok: false;
      field: "password" | "token";
      code: "INVALID" | "PASSWORD_TOO_SHORT";
      message: string;
    };

// Saleor's INVALID_TOKEN message. One answer for an unknown, inactive or wrong-token account.
const INVALID_TOKEN = {
  field: "token",
  code: "INVALID",
  message: "Invalid or expired token.",
} as const;

/**
 * Saleor's SetPassword: the token proves access to the account's email, so it sets a new password
 * and confirms the account if it wasn't (linking the email's guest orders, as confirmAccount).
 * Every session of the user ends: a reset usually means someone else may know the old password.
 * Returns the new session for the caller to put in the cookie. The token is checked before the
 * password, as Saleor does; both run on the locked row before anything is written.
 */
export async function setPassword(
  tx: Tx,
  input: { email: string; token: string; password: string },
  secret: string,
): Promise<SetPasswordResult> {
  const [user] = await tx
    .select(TOKEN_COLUMNS)
    .from(schema.user)
    .where(
      and(eq(schema.user.email, input.email.trim().toLowerCase()), eq(schema.user.isActive, true)),
    )
    .for("update");
  if (!user || !checkToken(user, input.token, PASSWORD_RESET_SALT, secret)) {
    return { ok: false, ...INVALID_TOKEN };
  }

  const passwordError = validateNewPassword(input.password);
  if (passwordError) return { ok: false, ...passwordError };

  // Hashed after both checks, inside the transaction: the row stays locked from the token check
  // to the update, so nothing can change underneath it.
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  await tx
    .update(schema.user)
    .set({ passwordHash, updatedAt: now, lastLogin: sql`now()`, isConfirmed: true })
    .where(eq(schema.user.id, user.id));
  // As confirmAccount: the email is proven now, so its guest orders become the account's.
  if (!user.isConfirmed) await matchOrdersWithNewUser(tx, user.id, user.email);

  await revokeUserSessions(tx, user.id);
  const session = await createSession(tx, user.id, now);
  return { ok: true, userId: user.id, session };
}
