"use server";

import { redirect } from "next/navigation";
import {
  AccountRegisterDocument,
  CheckoutCustomerAttachDocument,
  ConfirmAccountDocument,
  GuestCheckoutDocument,
  LogoutDocument,
  MyNewestCheckoutDocument,
  RequestPasswordResetDocument,
  SetPasswordDocument,
  TokenCreateDocument,
} from "@/gql/graphql";
import { mutate, mutateWithResponse } from "@/lib/api";
import {
  checkoutGlobalId,
  clearCheckoutCookie,
  readCheckoutToken,
  setCheckoutCookie,
} from "@/lib/cart/cookies";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { safeNextPath } from "@/lib/safe-redirect";
import { parseApiSessionCookie } from "./api-session-cookie";
import { clearSessionCookie, setSessionCookie } from "./cookies";
import type { AuthActionState, AuthErrorKey } from "./types";
import {
  type FieldErrors,
  textField,
  validateEmail,
  validateLogin,
  validateNewPassword,
  validateRegister,
} from "./validation";

// Auth Server Actions (ARCHITECTURE §10.8). Next checks each action's Origin against the host.
// URLs sent to the API come from STOREFRONT_URL, never from request headers. Only async functions
// are exported: everything exported here is callable from a browser.

type AccountError = { code: string; field: string | null };

const invalid = (fieldErrors: FieldErrors, email?: string): AuthActionState => ({
  status: "error",
  fieldErrors,
  email,
});
const failure = (message: AuthErrorKey, email?: string): AuthActionState => ({
  status: "error",
  message,
  email,
});

const LOGIN_ERRORS: Record<string, AuthErrorKey> = {
  INVALID_CREDENTIALS: "invalidCredentials",
  ACCOUNT_NOT_CONFIRMED: "notConfirmed",
  INACTIVE: "inactive",
  LOGIN_ATTEMPT_DELAYED: "tooManyAttempts",
};

/** What the API reports for a new or reset password. */
function passwordFailure(errors: AccountError[], email?: string): AuthActionState {
  const first = errors[0];
  if (first?.code === "PASSWORD_TOO_SHORT") return invalid({ password: "passwordTooShort" }, email);
  if (first?.code === "INVALID" && first.field === "email") {
    return invalid({ email: "invalidEmail" }, email);
  }
  if (first?.code === "INVALID" && first.field === "password") {
    return invalid({ password: "invalid" }, email);
  }
  return failure("generic", email);
}

/**
 * After a login: a non-empty guest checkout in the cookie is attached to the customer; otherwise
 * the customer's newest open checkout becomes the cookie's checkout (ARCHITECTURE §10.8). Never
 * throws, never fails the login: a checkout that can't be attached is dropped.
 */
async function mergeCart(token: string): Promise<void> {
  try {
    const guestToken = await readCheckoutToken();
    if (guestToken !== null) {
      const id = checkoutGlobalId(guestToken);
      const guest = await mutate(GuestCheckoutDocument, { variables: { id }, token });
      if (guest.ok && guest.data.checkout && guest.data.checkout.lines.length > 0) {
        const attached = await mutate(CheckoutCustomerAttachDocument, {
          variables: { id },
          token,
        });
        if (attached.ok && attached.data.checkoutCustomerAttach?.errors.length === 0) return;
        await clearCheckoutCookie(); // completed, or owned by someone else
      } else {
        await clearCheckoutCookie();
      }
    }
    const newest = await mutate(MyNewestCheckoutDocument, { token });
    const adopted = newest.ok ? newest.data.me?.checkouts?.edges[0]?.node.token : undefined;
    if (adopted) await setCheckoutCookie(adopted);
  } catch (error) {
    log.error("cart-merge-failed", { message: error instanceof Error ? error.message : "unknown" });
  }
}

/**
 * Takes the session out of a successful `tokenCreate` / `setPassword` response: refuses staff
 * (their session is revoked with its own token and no cookie is set), sets the cookie, merges the
 * cart. Returns an error state, or null when the shopper is signed in.
 */
async function startSession(
  headers: Headers | null,
  user: { isStaff: boolean } | null | undefined,
  email: string,
): Promise<AuthActionState | null> {
  const session = headers ? parseApiSessionCookie(headers) : null;
  if (!user || !session) {
    log.error("auth-no-session-cookie", { hasUser: Boolean(user) });
    return failure("generic", email);
  }
  if (user.isStaff) {
    await mutate(LogoutDocument, { token: session.token });
    return failure("staffNotAllowed", email);
  }
  await setSessionCookie(session.token, session.expires);
  await mergeCart(session.token);
  return null;
}

export async function login(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = textField(formData, "email").trim();
  const password = textField(formData, "password");
  const errors = validateLogin({ email, password });
  if (errors) return invalid(errors, email);

  const { result, headers } = await mutateWithResponse(TokenCreateDocument, {
    variables: { email, password },
  });
  if (!result.ok) return failure("unavailable", email);
  const { user, errors: apiErrors } = result.data.tokenCreate;
  if (apiErrors.length > 0) {
    return failure(LOGIN_ERRORS[apiErrors[0]?.code ?? ""] ?? "generic", email);
  }
  const refused = await startSession(headers, user, email);
  if (refused) return refused;
  redirect(safeNextPath(textField(formData, "next"), "/"));
}

/** A form action: ends the API session, clears both cookies, goes home. */
export async function logout(): Promise<void> {
  const result = await mutate(LogoutDocument);
  if (!result.ok) log.warn("logout-api-failed", { kind: result.error.kind });
  await clearSessionCookie();
  await clearCheckoutCookie();
  redirect("/");
}

export async function register(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = textField(formData, "email").trim();
  const password = textField(formData, "password");
  const errors = validateRegister({ email, password, confirm: textField(formData, "confirm") });
  if (errors) return invalid(errors, email);

  const result = await mutate(AccountRegisterDocument, {
    variables: {
      input: {
        email,
        password,
        firstName: textField(formData, "firstName").trim(),
        lastName: textField(formData, "lastName").trim(),
        redirectUrl: `${getEnv().storefrontUrl}/confirm-account`,
      },
    },
  });
  if (!result.ok) return failure("unavailable", email);
  const apiErrors = result.data.accountRegister.errors;
  if (apiErrors.length > 0) return passwordFailure(apiErrors, email);
  // The same for a new and an already registered email: the API does not reveal which.
  return { status: "success", email };
}

export async function requestPasswordReset(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = textField(formData, "email").trim();
  const errors = validateEmail(email);
  if (errors) return invalid(errors, email);

  const result = await mutate(RequestPasswordResetDocument, {
    variables: { email, redirectUrl: `${getEnv().storefrontUrl}/set-password` },
  });
  if (!result.ok) return failure("unavailable", email);
  if (result.data.requestPasswordReset.errors.length > 0) return failure("generic", email);
  return { status: "success", email };
}

/** Posted by a button on /confirm-account, never on page load (mail scanners open links). */
export async function confirmAccount(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = textField(formData, "email");
  const token = textField(formData, "token");
  if (email === "" || token === "") return failure("linkInvalid", email);

  const result = await mutate(ConfirmAccountDocument, { variables: { email, token } });
  if (!result.ok) return failure("unavailable", email);
  const { user, errors } = result.data.confirmAccount;
  if (errors.length > 0 || !user) {
    return failure(errors[0]?.code === "INVALID" ? "linkInvalid" : "generic", email);
  }
  return { status: "success", email };
}

export async function setPassword(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = textField(formData, "email");
  const token = textField(formData, "token");
  const password = textField(formData, "password");
  if (email === "" || token === "") return failure("linkInvalid", email);
  const errors = validateNewPassword({ password, confirm: textField(formData, "confirm") });
  if (errors) return invalid(errors, email);

  const { result, headers } = await mutateWithResponse(SetPasswordDocument, {
    variables: { email, token, password },
  });
  if (!result.ok) return failure("unavailable", email);
  const { user, errors: apiErrors } = result.data.setPassword;
  if (apiErrors.length > 0) {
    const first = apiErrors[0];
    if (first?.code === "INVALID" && first.field === "token") return failure("linkInvalid", email);
    return passwordFailure(apiErrors, email);
  }
  const refused = await startSession(headers, user, email);
  if (refused) return refused;
  redirect("/");
}
