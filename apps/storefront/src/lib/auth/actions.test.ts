import { beforeEach, describe, expect, it, vi } from "vitest";

class Redirect extends Error {
  constructor(readonly path: string) {
    super(`redirect ${path}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Redirect(path);
  },
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ storefrontUrl: "http://localhost:3007" }) }));

const mutate = vi.fn();
const mutateWithResponse = vi.fn();
vi.mock("@/lib/api", () => ({ mutate, mutateWithResponse }));

const setSessionCookie = vi.fn();
const clearSessionCookie = vi.fn();
vi.mock("./cookies", () => ({ setSessionCookie, clearSessionCookie }));

const readCheckoutToken = vi.fn();
const setCheckoutCookie = vi.fn();
const clearCheckoutCookie = vi.fn();
vi.mock("@/lib/cart/cookies", () => ({
  readCheckoutToken,
  setCheckoutCookie,
  clearCheckoutCookie,
  checkoutGlobalId: (token: string) => `gid:${token}`,
}));

const actions = await import("./actions");

const EXPIRES = new Date("2026-12-24T10:20:30.000Z");
const SESSION = `session=tok-1; Path=/; Expires=${EXPIRES.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
const withSession = () => {
  const headers = new Headers();
  headers.append("set-cookie", SESSION);
  return headers;
};
const customer = { id: "u1", email: "a@b.mn", firstName: "", lastName: "", isStaff: false };
const apiFailure = { ok: false, error: new Error("down") };
const ok = <T>(data: T) => ({ ok: true as const, data });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}
const idle = { status: "idle" as const };
const operation = (doc: unknown) => /(?:mutation|query)\s+(\w+)/.exec(String(doc))?.[1];
const callsOf = (name: string) =>
  mutate.mock.calls.filter(([doc]) => operation(doc) === name) as [
    unknown,
    { variables?: unknown; token?: string },
  ][];

/** `mutate` answers by operation name; unlisted operations succeed with nothing. */
function mutateAnswers(answers: Record<string, unknown>) {
  mutate.mockImplementation(async (doc: unknown) => {
    const answer = answers[operation(doc) ?? ""];
    return answer ?? ok({});
  });
}

async function run(promise: Promise<unknown>) {
  try {
    return { state: await promise, redirect: null as string | null };
  } catch (error) {
    if (error instanceof Redirect) return { state: null, redirect: error.path };
    throw error;
  }
}

beforeEach(() => {
  for (const fn of [
    mutate,
    mutateWithResponse,
    setSessionCookie,
    clearSessionCookie,
    readCheckoutToken,
    setCheckoutCookie,
    clearCheckoutCookie,
  ]) {
    fn.mockReset();
  }
  readCheckoutToken.mockResolvedValue(null);
  mutateAnswers({});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

const loginOk = (user = customer) =>
  mutateWithResponse.mockResolvedValue({
    result: ok({ tokenCreate: { user, errors: [] } }),
    headers: withSession(),
  });
const loginForm = (extra: Record<string, string> = {}) =>
  form({ email: "a@b.mn", password: "secret-pw", ...extra });

describe("login", () => {
  it("validates before calling the API and echoes the email, never the password", async () => {
    const { state } = await run(actions.login(idle, form({ email: "nope", password: "" })));
    expect(state).toEqual({
      status: "error",
      fieldErrors: { email: "invalidEmail", password: "passwordRequired" },
      email: "nope",
    });
    expect(JSON.stringify(state)).not.toContain("secret");
    expect(mutateWithResponse).not.toHaveBeenCalled();
  });

  it.each([
    ["INVALID_CREDENTIALS", "invalidCredentials"],
    ["ACCOUNT_NOT_CONFIRMED", "notConfirmed"],
    ["INACTIVE", "inactive"],
    ["LOGIN_ATTEMPT_DELAYED", "tooManyAttempts"],
    ["UNKNOWN_IP_ADDRESS", "generic"],
  ])("maps %s to %s and sets no cookie", async (code, key) => {
    mutateWithResponse.mockResolvedValue({
      result: ok({ tokenCreate: { user: null, errors: [{ code, field: null }] } }),
      headers: new Headers(),
    });
    const { state } = await run(actions.login(idle, loginForm()));
    expect(state).toEqual({ status: "error", message: key, email: "a@b.mn" });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("says unavailable when the API fails", async () => {
    mutateWithResponse.mockResolvedValue({ result: apiFailure, headers: null });
    const { state } = await run(actions.login(idle, loginForm()));
    expect(state).toMatchObject({ status: "error", message: "unavailable" });
  });

  it("says generic, without a cookie, when the API sent no session cookie", async () => {
    mutateWithResponse.mockResolvedValue({
      result: ok({ tokenCreate: { user: customer, errors: [] } }),
      headers: new Headers(),
    });
    const { state } = await run(actions.login(idle, loginForm()));
    expect(state).toMatchObject({ status: "error", message: "generic" });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it("sets the cookie from the API's Set-Cookie and goes to the safe next path", async () => {
    loginOk();
    const { redirect } = await run(actions.login(idle, loginForm({ next: "/products/x?a=1" })));
    expect(setSessionCookie).toHaveBeenCalledWith("tok-1", EXPIRES);
    expect(redirect).toBe("/products/x?a=1");
  });

  it.each(["//evil.example", "https://evil.example", "/\\evil", "/login"])(
    "goes home instead of %s",
    async (next) => {
      loginOk();
      const { redirect } = await run(actions.login(idle, loginForm({ next })));
      expect(redirect).toBe("/");
    },
  );

  it("refuses staff: revokes the session with the returned token and sets no cookie", async () => {
    loginOk({ ...customer, isStaff: true });
    const { state, redirect } = await run(actions.login(idle, loginForm()));
    expect(state).toMatchObject({ status: "error", message: "staffNotAllowed" });
    expect(redirect).toBeNull();
    const logouts = callsOf("Logout");
    expect(logouts).toHaveLength(1);
    expect(logouts[0]?.[1].token).toBe("tok-1");
    expect(setSessionCookie).not.toHaveBeenCalled();
    expect(mutateWithResponse).toHaveBeenCalledTimes(1);
  });
});

describe("cart merge at login", () => {
  const GUEST = "9b2f6c1e-8d4a-4e3b-9a7c-1f2e3d4c5b6a";

  it("attaches a non-empty guest checkout using the new token and keeps the cookie", async () => {
    loginOk();
    readCheckoutToken.mockResolvedValue(GUEST);
    mutateAnswers({
      GuestCheckout: ok({ checkout: { id: "c", lines: [{ id: "l1" }] } }),
      CheckoutCustomerAttach: ok({ checkoutCustomerAttach: { errors: [] } }),
    });
    await run(actions.login(idle, loginForm()));
    const attach = callsOf("CheckoutCustomerAttach");
    expect(attach).toHaveLength(1);
    expect(attach[0]?.[1]).toEqual({ variables: { id: `gid:${GUEST}` }, token: "tok-1" });
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
    expect(callsOf("MyNewestCheckout")).toHaveLength(0);
  });

  it("adopts the customer's newest checkout when there is no guest checkout", async () => {
    loginOk();
    mutateAnswers({
      MyNewestCheckout: ok({ me: { checkouts: { edges: [{ node: { token: "newest" } }] } } }),
    });
    await run(actions.login(idle, loginForm()));
    expect(setCheckoutCookie).toHaveBeenCalledWith("newest");
    expect(callsOf("MyNewestCheckout")[0]?.[1].token).toBe("tok-1");
  });

  it("drops an empty guest checkout and adopts the newest", async () => {
    loginOk();
    readCheckoutToken.mockResolvedValue(GUEST);
    mutateAnswers({
      GuestCheckout: ok({ checkout: { id: "c", lines: [] } }),
      MyNewestCheckout: ok({ me: { checkouts: { edges: [{ node: { token: "newest" } }] } } }),
    });
    await run(actions.login(idle, loginForm()));
    expect(callsOf("CheckoutCustomerAttach")).toHaveLength(0);
    expect(clearCheckoutCookie).toHaveBeenCalled();
    expect(setCheckoutCookie).toHaveBeenCalledWith("newest");
  });

  it("clears the checkout cookie when attaching fails, and still signs in", async () => {
    loginOk();
    readCheckoutToken.mockResolvedValue(GUEST);
    mutateAnswers({
      GuestCheckout: ok({ checkout: { id: "c", lines: [{ id: "l1" }] } }),
      CheckoutCustomerAttach: ok({
        checkoutCustomerAttach: { errors: [{ code: "INVALID" }] },
      }),
      MyNewestCheckout: ok({ me: { checkouts: { edges: [] } } }),
    });
    const { redirect } = await run(actions.login(idle, loginForm()));
    expect(clearCheckoutCookie).toHaveBeenCalled();
    expect(setCheckoutCookie).not.toHaveBeenCalled();
    expect(redirect).toBe("/");
  });

  it("never fails the login when the merge throws", async () => {
    loginOk();
    mutate.mockRejectedValue(new Error("boom"));
    readCheckoutToken.mockResolvedValue(GUEST);
    const { redirect } = await run(actions.login(idle, loginForm()));
    expect(setSessionCookie).toHaveBeenCalled();
    expect(redirect).toBe("/");
  });
});

describe("logout", () => {
  it("ends the API session, clears both cookies and goes home", async () => {
    const { redirect } = await run(actions.logout());
    expect(callsOf("Logout")).toHaveLength(1);
    expect(clearSessionCookie).toHaveBeenCalled();
    expect(clearCheckoutCookie).toHaveBeenCalled();
    expect(redirect).toBe("/");
  });
  it("clears the cookies even when the API is down", async () => {
    mutate.mockResolvedValue(apiFailure);
    const { redirect } = await run(actions.logout());
    expect(clearSessionCookie).toHaveBeenCalled();
    expect(redirect).toBe("/");
  });
});

describe("register", () => {
  const fields = { email: "a@b.mn", password: "12345678", confirm: "12345678" };

  it("validates first", async () => {
    const { state } = await run(
      actions.register(idle, form({ email: "a@b.mn", password: "123", confirm: "1" })),
    );
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { password: "passwordTooShort", confirm: "passwordsMismatch" },
    });
    expect(mutate).not.toHaveBeenCalled();
  });
  it("sends the confirmation URL built from STOREFRONT_URL and shows success", async () => {
    mutateAnswers({ AccountRegister: ok({ accountRegister: { errors: [] } }) });
    const { state } = await run(
      actions.register(idle, form({ ...fields, firstName: "Ану", lastName: "Бат" })),
    );
    expect(state).toEqual({ status: "success", email: "a@b.mn" });
    expect(callsOf("AccountRegister")[0]?.[1].variables).toEqual({
      input: {
        email: "a@b.mn",
        password: "12345678",
        firstName: "Ану",
        lastName: "Бат",
        redirectUrl: "http://localhost:3007/confirm-account",
      },
    });
  });
  it("maps PASSWORD_TOO_SHORT, INVALID and others", async () => {
    mutateAnswers({
      AccountRegister: ok({
        accountRegister: { errors: [{ code: "PASSWORD_TOO_SHORT", field: "password" }] },
      }),
    });
    expect((await run(actions.register(idle, form(fields)))).state).toMatchObject({
      fieldErrors: { password: "passwordTooShort" },
    });
    mutateAnswers({
      AccountRegister: ok({ accountRegister: { errors: [{ code: "INVALID", field: "email" }] } }),
    });
    expect((await run(actions.register(idle, form(fields)))).state).toMatchObject({
      fieldErrors: { email: "invalidEmail" },
    });
    mutateAnswers({
      AccountRegister: ok({
        accountRegister: { errors: [{ code: "INVALID", field: "redirectUrl" }] },
      }),
    });
    expect((await run(actions.register(idle, form(fields)))).state).toMatchObject({
      message: "generic",
    });
  });
  it("says unavailable when the API fails", async () => {
    mutate.mockResolvedValue(apiFailure);
    expect((await run(actions.register(idle, form(fields)))).state).toMatchObject({
      message: "unavailable",
    });
  });
});

describe("requestPasswordReset", () => {
  it("validates the email, then sends the set-password URL", async () => {
    expect(
      (await run(actions.requestPasswordReset(idle, form({ email: "x" })))).state,
    ).toMatchObject({
      fieldErrors: { email: "invalidEmail" },
    });
    mutateAnswers({ RequestPasswordReset: ok({ requestPasswordReset: { errors: [] } }) });
    const { state } = await run(actions.requestPasswordReset(idle, form({ email: "a@b.mn" })));
    expect(state).toEqual({ status: "success", email: "a@b.mn" });
    expect(callsOf("RequestPasswordReset")[0]?.[1].variables).toEqual({
      email: "a@b.mn",
      redirectUrl: "http://localhost:3007/set-password",
    });
  });
});

describe("confirmAccount", () => {
  const link = form({ email: "a@b.mn", token: "t" });
  it("succeeds with a user and no errors", async () => {
    mutateAnswers({ ConfirmAccount: ok({ confirmAccount: { user: { id: "u" }, errors: [] } }) });
    expect((await run(actions.confirmAccount(idle, link))).state).toEqual({
      status: "success",
      email: "a@b.mn",
    });
  });
  it("says linkInvalid for an invalid or expired token, or a link without parts", async () => {
    mutateAnswers({
      ConfirmAccount: ok({
        confirmAccount: { user: null, errors: [{ code: "INVALID", field: "token" }] },
      }),
    });
    expect((await run(actions.confirmAccount(idle, link))).state).toMatchObject({
      message: "linkInvalid",
    });
    mutate.mockClear();
    expect(
      (await run(actions.confirmAccount(idle, form({ email: "a@b.mn" })))).state,
    ).toMatchObject({
      message: "linkInvalid",
    });
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("setPassword", () => {
  const fields = { email: "a@b.mn", token: "t", password: "12345678", confirm: "12345678" };
  const answer = (errors: unknown[], user: unknown = customer) =>
    mutateWithResponse.mockResolvedValue({
      result: ok({ setPassword: { user, errors } }),
      headers: withSession(),
    });

  it("validates the passwords before calling the API", async () => {
    const { state } = await run(actions.setPassword(idle, form({ ...fields, confirm: "x" })));
    expect(state).toMatchObject({ fieldErrors: { confirm: "passwordsMismatch" } });
    expect(mutateWithResponse).not.toHaveBeenCalled();
  });
  it("signs the customer in and goes home", async () => {
    answer([]);
    const { redirect } = await run(actions.setPassword(idle, form(fields)));
    expect(setSessionCookie).toHaveBeenCalledWith("tok-1", EXPIRES);
    expect(redirect).toBe("/");
  });
  it("says linkInvalid for a bad token and maps a short password", async () => {
    answer([{ code: "INVALID", field: "token" }], null);
    expect((await run(actions.setPassword(idle, form(fields)))).state).toMatchObject({
      message: "linkInvalid",
    });
    answer([{ code: "PASSWORD_TOO_SHORT", field: "password" }], null);
    expect((await run(actions.setPassword(idle, form(fields)))).state).toMatchObject({
      fieldErrors: { password: "passwordTooShort" },
    });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });
  it("refuses staff like login does", async () => {
    answer([], { ...customer, isStaff: true });
    const { state } = await run(actions.setPassword(idle, form(fields)));
    expect(state).toMatchObject({ message: "staffNotAllowed" });
    expect(callsOf("Logout")[0]?.[1].token).toBe("tok-1");
    expect(setSessionCookie).not.toHaveBeenCalled();
  });
});
