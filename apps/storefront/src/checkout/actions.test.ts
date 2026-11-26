import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/types";

const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh }));

// `redirect` never returns: like Next's, the mock throws, and `outcome` reads the target.
class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

const mutate = vi.fn();
vi.mock("@/lib/api", () => ({ mutate }));

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));

const readCheckoutToken = vi.fn();
const clearCheckoutCookie = vi.fn();
vi.mock("@/lib/cart/cookies", () => ({
  readCheckoutToken,
  clearCheckoutCookie,
  checkoutGlobalId: (token: string) => `gid:${token}`,
}));

const getEnv = vi.fn();
vi.mock("@/lib/env", () => ({ getEnv }));

const { chooseDelivery, placeOrder, saveShippingAddress, setEmail } = await import("./actions");

const TOKEN = "5b0c7f0e-1111-4222-8333-944455556666";
const ID = `gid:${TOKEN}`;
const ATTEMPT = "11111111-2222-4333-8444-555555555555";
const ORDER_TOKEN = "99999999-2222-4333-8444-555555555555";
const METHOD = "U2hpcHBpbmdNZXRob2Q6MQ";

const operation = (doc: unknown) => /(?:mutation|query)\s+(\w+)/.exec(String(doc))?.[1] ?? "";
const calls = (name: string) =>
  mutate.mock.calls.filter(([doc]) => operation(doc) === name) as [
    unknown,
    { variables: Record<string, unknown> },
  ][];

type Answer = unknown;
/** `mutate` answers by operation name; an array answers one call at a time (the last repeats). */
function answers(map: Record<string, Answer | Answer[]>) {
  const seen = new Map<string, number>();
  mutate.mockImplementation(async (doc: unknown) => {
    const name = operation(doc);
    const answer = map[name];
    if (answer === undefined) throw new Error(`unexpected API call: ${name}`);
    if (!Array.isArray(answer)) return answer;
    const index = seen.get(name) ?? 0;
    seen.set(name, index + 1);
    return answer[Math.min(index, answer.length - 1)];
  });
}

async function outcome<T>(run: () => Promise<T>): Promise<T | { redirect: string }> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Redirect) return { redirect: error.url };
    throw error;
  }
}

const ok = (data: unknown) => ({ ok: true as const, data });
const apiDown = (kind: "network" | "timeout" = "network") => ({
  ok: false as const,
  error: new ApiError({ kind, operation: "Op", requestId: "r" }),
});
const fault = (code: string, field: string | null = null) => ({ code, field, message: "m" });
const payload = (name: string, errors: unknown[] = []) =>
  ok({ [name]: { checkout: { id: ID }, errors } });

const address = {
  id: "a1",
  firstName: "Бат",
  lastName: "Дорж",
  companyName: "",
  streetAddress1: "1-р хороо",
  streetAddress2: "",
  city: "Баянзүрх",
  cityArea: "1-р хороо",
  postalCode: "",
  countryArea: "Улаанбаатар",
  phone: "+97699112233",
  country: { code: "MN", country: "Монгол" },
};

type Checkout = {
  email: string | null;
  chargeStatus: string;
  lines: unknown[];
  shippingAddress: unknown;
  billingAddress: unknown;
  delivery: unknown;
};
const checkout = (overrides: Partial<Checkout> = {}): Checkout => ({
  email: "bat@example.com",
  chargeStatus: "NONE",
  lines: [{ id: "l1" }],
  shippingAddress: address,
  billingAddress: null,
  delivery: { shippingMethod: { id: METHOD } },
  ...overrides,
});
const state = (overrides: Partial<Checkout> = {}) =>
  ok({ checkout: { id: ID, ...checkout(overrides) } });

const initialized = (type = "CHARGE_SUCCESS") =>
  ok({
    transactionInitialize: { transaction: { id: "t1" }, transactionEvent: { type }, errors: [] },
  });
const initFailed = (code: string, field: string | null = null) =>
  ok({
    transactionInitialize: {
      transaction: null,
      transactionEvent: null,
      errors: [fault(code, field)],
    },
  });
const completed = ok({
  checkoutComplete: { order: { id: "o1", token: ORDER_TOKEN }, errors: [] },
});
const completionFailed = (code: string, field: string | null = null) =>
  ok({ checkoutComplete: { order: null, errors: [fault(code, field)] } });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}
const paymentForm = (extra: Record<string, string> = {}) =>
  form({ attemptId: ATTEMPT, providerId: "dummy", billingSameAsShipping: "true", ...extra });
const idle = { status: "idle" } as const;
const place = (data = paymentForm()) => outcome(() => placeOrder(idle, data));

/** Happy path: every call succeeds and the checkout is unpaid until the transaction. */
const happy = {
  CheckoutPaymentState: state(),
  CheckoutBillingAddressUpdate: payload("checkoutBillingAddressUpdate"),
  TransactionInitialize: initialized(),
  CheckoutComplete: completed,
};

beforeEach(() => {
  for (const fn of [
    refresh,
    mutate,
    getCurrentUser,
    readCheckoutToken,
    clearCheckoutCookie,
    getEnv,
  ]) {
    fn.mockReset();
  }
  readCheckoutToken.mockResolvedValue(TOKEN);
  getCurrentUser.mockResolvedValue({ status: "guest" });
  getEnv.mockReturnValue({ paymentProviders: ["dummy"] });
});

describe("placeOrder: input", () => {
  it.each([
    ["missing", ""],
    ["not a uuid", "not-a-uuid"],
    ["with an injected suffix", `${ATTEMPT}; drop`],
  ])("refuses an attempt id that is %s without calling the API", async (_name, attemptId) => {
    expect(await place(paymentForm({ attemptId }))).toEqual({
      status: "error",
      message: "invalidAttempt",
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown", "stripe"],
    ["missing", ""],
  ])("refuses a provider that is %s without calling the API", async (_name, providerId) => {
    expect(await place(paymentForm({ providerId }))).toEqual({
      status: "error",
      message: "providerUnavailable",
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("refuses a provider that is registered but not enabled", async () => {
    getEnv.mockReturnValue({ paymentProviders: [] });
    expect(await place()).toMatchObject({ status: "error", message: "providerUnavailable" });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends a shopper without a checkout cookie to the cart", async () => {
    readCheckoutToken.mockResolvedValue(null);
    expect(await place()).toEqual({ redirect: "/cart" });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("returns billing field errors before any API call when billing is not the shipping address", async () => {
    const result = await place(paymentForm({ billingSameAsShipping: "" }));
    expect(result).toMatchObject({ status: "error" });
    expect((result as { fieldErrors: Record<string, string> }).fieldErrors.firstName).toBe(
      "required",
    );
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("placeOrder: the live read", () => {
  it("is an outage, not a failure to pay, when the API cannot be reached", async () => {
    answers({ CheckoutPaymentState: apiDown("timeout") });
    expect(await place()).toMatchObject({ status: "error", message: "unavailable" });
    expect(calls("TransactionInitialize")).toHaveLength(0);
  });

  it("clears the cookie and goes to the cart when the checkout is gone", async () => {
    answers({ CheckoutPaymentState: ok({ checkout: null }) });
    expect(await place()).toEqual({ redirect: "/cart" });
    expect(clearCheckoutCookie).toHaveBeenCalledOnce();
  });

  it("goes back to the cart when the checkout has no lines, charging nothing", async () => {
    answers({ CheckoutPaymentState: state({ lines: [] }) });
    expect(await place()).toEqual({ redirect: "/cart" });
    expect(calls("TransactionInitialize")).toHaveLength(0);
  });

  it("goes to the step that is missing instead of charging", async () => {
    answers({ CheckoutPaymentState: state({ email: null }) });
    expect(await place()).toEqual({ redirect: "/checkout?step=contact" });
    answers({ CheckoutPaymentState: state({ shippingAddress: null }) });
    expect(await place()).toEqual({ redirect: "/checkout?step=shipping" });
    answers({ CheckoutPaymentState: state({ delivery: null }) });
    expect(await place()).toEqual({ redirect: "/checkout?step=shipping" });
    expect(calls("TransactionInitialize")).toHaveLength(0);
  });
});

describe("placeOrder: success", () => {
  it("copies the shipping address to billing, charges once with the attempt id, completes, clears the cookie and redirects", async () => {
    answers(happy);
    expect(await place()).toEqual({ redirect: `/order/${ORDER_TOKEN}` });

    const billing = calls("CheckoutBillingAddressUpdate");
    expect(billing).toHaveLength(1);
    // Copied on the server from the live read: the browser sent no billing fields.
    expect(billing[0]?.[1].variables).toMatchObject({
      id: ID,
      address: { firstName: "Бат", lastName: "Дорж", country: "MN", city: "Баянзүрх" },
    });

    const init = calls("TransactionInitialize");
    expect(init).toHaveLength(1);
    expect(init[0]?.[1].variables).toEqual({
      id: ID,
      gatewayId: "saleor.io.dummy-payment-app",
      data: { event: { type: "CHARGE_SUCCESS" } },
      idempotencyKey: ATTEMPT,
    });
    // The browser never names an amount: the document has no amount variable.
    expect(init[0]?.[1].variables).not.toHaveProperty("amount");

    expect(calls("CheckoutComplete")).toHaveLength(1);
    expect(clearCheckoutCookie).toHaveBeenCalledOnce();
    // Order of the money-critical calls: read, billing, charge, complete.
    expect(mutate.mock.calls.map(([doc]) => operation(doc))).toEqual([
      "CheckoutPaymentState",
      "CheckoutBillingAddressUpdate",
      "TransactionInitialize",
      "CheckoutComplete",
    ]);
  });

  it("uses a billing address from the form when it is not the shipping address", async () => {
    answers(happy);
    const result = await place(
      paymentForm({
        billingSameAsShipping: "",
        firstName: "Сараа",
        lastName: "Бат",
        country: "MN",
        city: "Хан-Уул",
        streetAddress1: "5-р хороо",
      }),
    );
    expect(result).toEqual({ redirect: `/order/${ORDER_TOKEN}` });
    expect(calls("CheckoutBillingAddressUpdate")[0]?.[1].variables).toMatchObject({
      address: { firstName: "Сараа", city: "Хан-Уул", country: "MN" },
    });
  });

  it("does not clear the cookie when the order is not placed", async () => {
    answers({ ...happy, CheckoutComplete: completionFailed("INSUFFICIENT_STOCK", "quantity") });
    await place();
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
  });

  it("refuses to redirect to an order token that is not a uuid", async () => {
    answers({
      ...happy,
      CheckoutComplete: ok({
        checkoutComplete: { order: { id: "o1", token: "../../evil" }, errors: [] },
      }),
    });
    expect(await place()).toMatchObject({ status: "error", message: "generic" });
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
  });
});

describe("placeOrder: never charges twice", () => {
  it.each(["FULL", "OVERCHARGED"])(
    "skips billing and payment when already %s",
    async (chargeStatus) => {
      answers({ CheckoutPaymentState: state({ chargeStatus }), CheckoutComplete: completed });
      expect(await place()).toEqual({ redirect: `/order/${ORDER_TOKEN}` });
      expect(calls("TransactionInitialize")).toHaveLength(0);
      expect(calls("CheckoutBillingAddressUpdate")).toHaveLength(0);
      expect(calls("CheckoutComplete")).toHaveLength(1);
    },
  );

  it("charges a PARTIAL checkout (the remainder) under the attempt id", async () => {
    answers({ ...happy, CheckoutPaymentState: state({ chargeStatus: "PARTIAL" }) });
    await place();
    expect(calls("TransactionInitialize")).toHaveLength(1);
  });

  it("after a completion failure, the retry reuses the payment: no second charge", async () => {
    // First try: charged, but the stock ran out at completion.
    answers({ ...happy, CheckoutComplete: completionFailed("INSUFFICIENT_STOCK", "quantity") });
    const first = await place();
    expect(first).toMatchObject({ status: "error", message: "insufficientStock" });
    // The same attempt id stays (no nextAttemptId): the form keeps posting it.
    expect(first).not.toHaveProperty("nextAttemptId");
    expect(calls("TransactionInitialize")).toHaveLength(1);

    // Retry: the API now reads the checkout as fully charged.
    mutate.mockReset();
    answers({ CheckoutPaymentState: state({ chargeStatus: "FULL" }), CheckoutComplete: completed });
    expect(await place()).toEqual({ redirect: `/order/${ORDER_TOKEN}` });
    expect(calls("TransactionInitialize")).toHaveLength(0);
  });

  it("a retry after a timeout reuses the attempt id, and the API's 'nothing left to pay' continues to completion", async () => {
    // First try timed out on the charge (it may have gone through).
    answers({ ...happy, TransactionInitialize: apiDown("timeout") });
    const first = await place();
    expect(first).toMatchObject({ status: "error", message: "unavailable" });
    expect(first).not.toHaveProperty("nextAttemptId");
    expect(calls("CheckoutComplete")).toHaveLength(0);

    // Retry with the same key: the first attempt did charge, so the API says it is covered.
    mutate.mockReset();
    answers({
      CheckoutPaymentState: [state(), state({ chargeStatus: "FULL" })],
      CheckoutBillingAddressUpdate: payload("checkoutBillingAddressUpdate"),
      TransactionInitialize: initFailed("INVALID", "amount"),
      CheckoutComplete: completed,
    });
    expect(await place()).toEqual({ redirect: `/order/${ORDER_TOKEN}` });
    expect(calls("TransactionInitialize")[0]?.[1].variables.idempotencyKey).toBe(ATTEMPT);
    expect(calls("CheckoutComplete")).toHaveLength(1);
  });

  it("does not trust 'nothing left to pay' unless the checkout reads as paid", async () => {
    answers({
      ...happy,
      CheckoutPaymentState: [state(), state({ chargeStatus: "NONE" })],
      TransactionInitialize: initFailed("INVALID", "amount"),
    });
    expect(await place()).toMatchObject({ status: "error", message: "generic" });
    expect(calls("CheckoutComplete")).toHaveLength(0);
  });

  it("a double submit: the second one finds the checkout covered or completed and gets the order", async () => {
    // Concurrent twin lost the race: the checkout was completed meanwhile.
    answers({ ...happy, TransactionInitialize: initFailed("INVALID", "id") });
    expect(await place()).toEqual({ redirect: `/order/${ORDER_TOKEN}` });
    expect(calls("CheckoutComplete")).toHaveLength(1);
  });
});

describe("placeOrder: the payment fails", () => {
  it("a declined payment is shown, completes nothing and gives a new attempt id", async () => {
    answers({ ...happy, TransactionInitialize: initialized("CHARGE_FAILURE") });
    const result = await place();
    expect(result).toMatchObject({ status: "error", message: "paymentDeclined" });
    const next = (result as { nextAttemptId?: string }).nextAttemptId;
    expect(next).toMatch(/^[0-9a-f-]{36}$/);
    expect(next).not.toBe(ATTEMPT);
    expect(calls("CheckoutComplete")).toHaveLength(0);
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
  });

  it("the key used for a different amount (UNIQUE) says the amount changed and gives a new attempt id", async () => {
    answers({ ...happy, TransactionInitialize: initFailed("UNIQUE", "idempotencyKey") });
    const result = await place();
    expect(result).toMatchObject({ status: "error", message: "paymentChanged" });
    expect((result as { nextAttemptId?: string }).nextAttemptId).toBeDefined();
    expect(calls("CheckoutComplete")).toHaveLength(0);
  });

  it.each([
    ["an unknown gateway", initFailed("NOT_FOUND", "paymentGateway")],
    [
      "a transaction that is missing",
      ok({ transactionInitialize: { transaction: null, transactionEvent: null, errors: [] } }),
    ],
  ])("%s is a generic error and completes nothing", async (_name, init) => {
    answers({ ...happy, TransactionInitialize: init });
    expect(await place()).toMatchObject({ status: "error", message: "generic" });
    expect(calls("CheckoutComplete")).toHaveLength(0);
  });

  it("an API outage on the charge is retried under the same attempt id", async () => {
    answers({ ...happy, TransactionInitialize: apiDown() });
    const result = await place();
    expect(result).toMatchObject({ status: "error", message: "unavailable" });
    expect(result).not.toHaveProperty("nextAttemptId");
    expect(calls("CheckoutComplete")).toHaveLength(0);
  });

  it("an outage while setting the billing address charges nothing", async () => {
    answers({ ...happy, CheckoutBillingAddressUpdate: apiDown() });
    expect(await place()).toMatchObject({ status: "error", message: "unavailable" });
    expect(calls("TransactionInitialize")).toHaveLength(0);
  });

  it("billing errors from the API come back as field errors and charge nothing", async () => {
    answers({
      ...happy,
      CheckoutBillingAddressUpdate: payload("checkoutBillingAddressUpdate", [
        fault("INVALID", "phone"),
      ]),
    });
    const result = (await place()) as { fieldErrors: Record<string, string> };
    expect(result.fieldErrors.phone).toBe("invalid");
    expect(calls("TransactionInitialize")).toHaveLength(0);
  });
});

describe("placeOrder: completion errors", () => {
  it.each([
    ["INSUFFICIENT_STOCK", "insufficientStock", false],
    ["PRODUCT_NOT_PUBLISHED", "notAvailable", false],
    ["CHECKOUT_NOT_FULLY_PAID", "notFullyPaid", true],
    ["SOMETHING_NEW", "generic", false],
  ])("%s → %s (new attempt id: %s)", async (code, message, spentAttempt) => {
    answers({ ...happy, CheckoutComplete: completionFailed(code) });
    const result = await place();
    expect(result).toMatchObject({ status: "error", message });
    expect("nextAttemptId" in (result as object)).toBe(spentAttempt);
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
  });

  it.each([
    ["EMAIL_NOT_SET", "/checkout?step=contact"],
    ["SHIPPING_ADDRESS_NOT_SET", "/checkout?step=shipping"],
    ["SHIPPING_METHOD_NOT_SET", "/checkout?step=shipping"],
    ["INVALID_SHIPPING_METHOD", "/checkout?step=shipping"],
    ["BILLING_ADDRESS_NOT_SET", "/checkout?step=payment"],
    ["NO_LINES", "/cart"],
  ])("%s sends the shopper to %s", async (code, url) => {
    answers({ ...happy, CheckoutComplete: completionFailed(code) });
    expect(await place()).toEqual({ redirect: url });
  });

  it("an outage at completion keeps the checkout and the payment", async () => {
    answers({ ...happy, CheckoutComplete: apiDown("timeout") });
    const result = await place();
    expect(result).toMatchObject({ status: "error", message: "unavailable" });
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
  });
});

describe("setEmail", () => {
  it("sets a guest's email and moves to shipping", async () => {
    answers({ CheckoutEmailUpdate: payload("checkoutEmailUpdate") });
    const result = await outcome(() =>
      setEmail({ status: "idle" }, form({ email: " bat@example.com " })),
    );
    expect(result).toEqual({ redirect: "/checkout?step=shipping" });
    expect(calls("CheckoutEmailUpdate")[0]?.[1].variables).toEqual({
      id: ID,
      email: "bat@example.com",
    });
  });

  it("uses the signed-in customer's own email, never the form's", async () => {
    getCurrentUser.mockResolvedValue({
      status: "authenticated",
      user: { id: "u", email: "me@example.com", firstName: "", lastName: "" },
    });
    answers({ CheckoutEmailUpdate: payload("checkoutEmailUpdate") });
    await outcome(() => setEmail({ status: "idle" }, form({ email: "someone@else.com" })));
    expect(calls("CheckoutEmailUpdate")[0]?.[1].variables.email).toBe("me@example.com");
  });

  it("shows a field error for a bad email without calling the API", async () => {
    const result = await setEmail({ status: "idle" }, form({ email: "nope" }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { email: "invalidEmail" } });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("maps the API's email error to the field and an outage to a message", async () => {
    answers({ CheckoutEmailUpdate: payload("checkoutEmailUpdate", [fault("INVALID", "email")]) });
    expect(await setEmail({ status: "idle" }, form({ email: "a@b.co" }))).toMatchObject({
      fieldErrors: { email: "invalid" },
    });
    answers({ CheckoutEmailUpdate: apiDown() });
    expect(await setEmail({ status: "idle" }, form({ email: "a@b.co" }))).toMatchObject({
      message: "unavailable",
    });
  });

  it("leaves a completed checkout: clears the cookie and goes to the cart", async () => {
    answers({ CheckoutEmailUpdate: payload("checkoutEmailUpdate", [fault("INVALID", "id")]) });
    expect(await outcome(() => setEmail({ status: "idle" }, form({ email: "a@b.co" })))).toEqual({
      redirect: "/cart",
    });
    expect(clearCheckoutCookie).toHaveBeenCalledOnce();
  });
});

describe("saveShippingAddress", () => {
  const complete = {
    firstName: "Бат",
    lastName: "Дорж",
    country: "mn",
    city: "Баянзүрх",
    streetAddress1: "1-р хороо",
  };

  it("returns field errors without calling the API", async () => {
    const result = await saveShippingAddress({ status: "idle" }, form({ firstName: "Бат" }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { lastName: "required" } });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends the cleaned address and refreshes", async () => {
    answers({ CheckoutShippingAddressUpdate: payload("checkoutShippingAddressUpdate") });
    expect(await saveShippingAddress({ status: "idle" }, form(complete))).toEqual({
      status: "success",
    });
    expect(calls("CheckoutShippingAddressUpdate")[0]?.[1].variables).toMatchObject({
      id: ID,
      address: { firstName: "Бат", country: "MN" },
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("maps API field errors and keeps what was typed", async () => {
    answers({
      CheckoutShippingAddressUpdate: payload("checkoutShippingAddressUpdate", [
        fault("INVALID", "city"),
      ]),
    });
    const result = await saveShippingAddress({ status: "idle" }, form(complete));
    expect(result).toMatchObject({ status: "error", fieldErrors: { city: "invalid" } });
    expect((result as { values?: { city?: string } }).values?.city).toBe("Баянзүрх");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reports an outage", async () => {
    answers({ CheckoutShippingAddressUpdate: apiDown() });
    expect(await saveShippingAddress({ status: "idle" }, form(complete))).toMatchObject({
      message: "unavailable",
    });
  });
});

describe("chooseDelivery", () => {
  it("refuses an id that is not an id without calling the API", async () => {
    expect(await chooseDelivery({ status: "idle" }, form({ deliveryMethodId: "" }))).toEqual({
      status: "error",
      message: "invalidDeliveryMethod",
    });
    expect(await chooseDelivery({ status: "idle" }, form({ deliveryMethodId: "a b!" }))).toEqual({
      status: "error",
      message: "invalidDeliveryMethod",
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sets the method and moves to payment", async () => {
    answers({ CheckoutDeliveryMethodUpdate: payload("checkoutDeliveryMethodUpdate") });
    expect(
      await outcome(() => chooseDelivery({ status: "idle" }, form({ deliveryMethodId: METHOD }))),
    ).toEqual({ redirect: "/checkout?step=payment" });
    expect(calls("CheckoutDeliveryMethodUpdate")[0]?.[1].variables).toEqual({
      id: ID,
      deliveryMethodId: METHOD,
    });
  });

  it("maps a method the API does not accept, and an outage", async () => {
    answers({
      CheckoutDeliveryMethodUpdate: payload("checkoutDeliveryMethodUpdate", [
        fault("INVALID_SHIPPING_METHOD"),
      ]),
    });
    expect(
      await chooseDelivery({ status: "idle" }, form({ deliveryMethodId: METHOD })),
    ).toMatchObject({ message: "invalidDeliveryMethod" });
    answers({ CheckoutDeliveryMethodUpdate: apiDown() });
    expect(
      await chooseDelivery({ status: "idle" }, form({ deliveryMethodId: METHOD })),
    ).toMatchObject({ message: "unavailable" });
  });
});

describe("placeOrder with a gateway the shopper pays on its own page (Wire, ADR-0016)", () => {
  const WIRE_PAGE = "https://pay.wire.mn/c/cs_1";
  const actionRequired = (url: string | null) =>
    ok({
      transactionInitialize: {
        transaction: { id: "t1" },
        transactionEvent: { type: "CHARGE_ACTION_REQUIRED" },
        data: url === null ? null : { url },
        errors: [],
      },
    });
  const wireForm = () => paymentForm({ providerId: "wire" });

  beforeEach(() => {
    getEnv.mockReturnValue({
      paymentProviders: ["wire"],
      storefrontUrl: "https://dino-craft.lol",
      production: true,
    });
  });

  it("sends the shopper to Wire's page with the shop's return page, making no order yet", async () => {
    answers({ ...happy, TransactionInitialize: actionRequired(WIRE_PAGE) });
    expect(await place(wireForm())).toEqual({ redirect: WIRE_PAGE });
    expect(calls("TransactionInitialize")[0]?.[1].variables).toMatchObject({
      gatewayId: "mn.wire.payment",
      data: { returnUrl: "https://dino-craft.lol/checkout/return" },
      idempotencyKey: ATTEMPT,
    });
    expect(calls("CheckoutComplete")).toHaveLength(0);
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
  });

  it("refuses to send the shopper anywhere but Wire", async () => {
    answers({ ...happy, TransactionInitialize: actionRequired("https://evil.example/pay") });
    expect(await place(wireForm())).toMatchObject({ status: "error", message: "generic" });
  });

  it("starts a new attempt when this one's page has expired", async () => {
    answers({ ...happy, TransactionInitialize: actionRequired(null) });
    const result = await place(wireForm());
    expect(result).toMatchObject({ status: "error", message: "paymentExpired" });
    expect((result as { nextAttemptId?: string }).nextAttemptId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
