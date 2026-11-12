// Adapted from saleor-core: saleor/graphql/account/mutations/account/confirm_account.py,
// saleor/account/notifications.py (send_account_confirmation), saleor/core/utils/url.py
// (validate_storefront_url, prepare_url) and plugins/user_email/default_email_templates/confirm.html
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Account confirmation (PLAN M8.3): accountRegister creates an unconfirmed user and, in the same
// transaction, adds a job that emails a link to `redirectUrl?email=…&token=…` (the storefront's
// page, M4); that page calls confirmAccount(email, token). The token is made by the worker when
// it sends, so it reflects the user as stored then.
import type { Executor, Tx } from "@commerce/db";
import { schema } from "@commerce/db";
import { and, eq } from "drizzle-orm";
import { defineJobHandler, defineQueue, type EmailMessage, enqueue } from "../jobs/index.ts";
import { getShop } from "../shop/index.ts";
import { ACCOUNT_CONFIRM_SALT, checkToken, makeToken, readSecretKey } from "./tokens.ts";

/** Saleor's DEBUG default for ALLOWED_CLIENT_HOSTS; production must set it (M9). */
const DEFAULT_CLIENT_HOSTS = ["localhost", "127.0.0.1"];

/** `ALLOWED_CLIENT_HOSTS` (comma-separated, Saleor's setting): hosts a `redirectUrl` may use. */
export function readAllowedClientHosts(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const hosts = (env.ALLOWED_CLIENT_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== "");
  return hosts.length > 0 ? hosts : DEFAULT_CLIENT_HOSTS;
}

/** Django's validate_host: an exact host, ".example.com" for it and its subdomains, or "*". */
const hostAllowed = (host: string, allowed: readonly string[]): boolean =>
  allowed.some(
    (pattern) =>
      pattern === "*" ||
      pattern === host ||
      (pattern.startsWith(".") && (host.endsWith(pattern) || host === pattern.slice(1))),
  );

/**
 * Saleor's validate_storefront_url: an absolute http(s) URL on an allowed host, so the email
 * can't send people to someone else's site. Returns the error message, or null when it's fine.
 */
export function validateRedirectUrl(url: string, allowedHosts: readonly string[]): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL. Please check if URL is in RFC 1808 format.";
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
    return "Invalid URL. Please check if URL is in RFC 1808 format.";
  }
  const host = parsed.hostname.toLowerCase();
  if (!hostAllowed(host, allowedHosts)) {
    return `${host} is not allowed. Please check \`ALLOWED_CLIENT_HOSTS\` configuration.`;
  }
  return null;
}

/** Saleor's prepare_url: the redirect URL with the params added (its own query kept). */
export const confirmationUrl = (redirectUrl: string, email: string, token: string): string => {
  const url = new URL(redirectUrl);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return url.toString();
};

export const accountConfirmationQueue = defineQueue<{ userId: string; redirectUrl: string }>(
  "account-confirmation-email",
);

/** Adds the confirmation email job inside the registration transaction. */
export const enqueueAccountConfirmation = (tx: Tx, userId: string, redirectUrl: string) =>
  enqueue(tx, accountConfirmationQueue, { userId, redirectUrl });

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Saleor's "Account confirmation e-mail" (confirm.html), as plain text and simple HTML. */
export function renderAccountConfirmation(
  confirmUrl: string,
  shopName: string,
): Omit<EmailMessage, "to"> {
  const intro = `In order to log into ${shopName}, you have to confirm your email address first. Please click the link below to do so and log into your account.`;
  const notice = "This is an automatically generated e-mail, please do not reply.";
  return {
    subject: "Account confirmation e-mail",
    text: ["Hi!", "", intro, "", confirmUrl, "", notice, "", `Sincerely, ${shopName}`].join("\n"),
    html: `<!doctype html>
<html>
<body style="font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #000;">
<p>Hi!</p>
<p>${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(confirmUrl)}">${escapeHtml(confirmUrl)}</a></p>
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

/** The worker's handler: makes the token and sends the link, unless there's nothing to confirm. */
export const accountConfirmationHandler = defineJobHandler(
  accountConfirmationQueue,
  async ({ userId, redirectUrl }, { db, mailer }) => {
    const [user] = await db
      .select(TOKEN_COLUMNS)
      .from(schema.user)
      .where(eq(schema.user.id, userId));
    // Deleted or already confirmed meanwhile: finishing the job without an email is right.
    if (!user || user.isConfirmed) return;
    const token = makeToken(user, ACCOUNT_CONFIRM_SALT, readSecretKey());
    const shop = await getShop(db);
    await mailer.send({
      to: user.email,
      ...renderAccountConfirmation(confirmationUrl(redirectUrl, user.email, token), shop.name),
    });
  },
);

/**
 * Saleor's confirmAccount: an active user with this email and a valid token becomes confirmed.
 * A wrong email, a wrong or expired token, an already used token: all the same `null`, so the
 * answer doesn't tell whether the email exists. Returns the confirmed user's id and email.
 */
export async function confirmAccount(
  db: Executor,
  email: string,
  token: string,
  secret: string,
): Promise<{ id: string; email: string } | null> {
  const [user] = await db
    .select(TOKEN_COLUMNS)
    .from(schema.user)
    .where(and(eq(schema.user.email, email.trim()), eq(schema.user.isActive, true)));
  if (!user || !checkToken(user, token, ACCOUNT_CONFIRM_SALT, secret)) return null;
  const [confirmed] = await db
    .update(schema.user)
    .set({ isConfirmed: true, updatedAt: new Date() })
    .where(and(eq(schema.user.id, user.id), eq(schema.user.isConfirmed, false)))
    .returning({ id: schema.user.id, email: schema.user.email });
  // A concurrent confirmation won: the token hashed the unconfirmed state, so it is spent.
  return confirmed ?? null;
}
