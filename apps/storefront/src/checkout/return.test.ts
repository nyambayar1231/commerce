import { beforeEach, describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
vi.mock("@/lib/api", () => ({ mutate }));
const readCheckoutToken = vi.fn();
const clearCheckoutCookie = vi.fn();
vi.mock("@/lib/cart/cookies", () => ({
  readCheckoutToken,
  clearCheckoutCookie,
  checkoutGlobalId: (token: string) => `gid:${token}`,
}));

const { settlePaymentReturn } = await import("./return");

// Where the shopper lands back from the payment page (ADR-0016): the order once it exists,
// waiting while the gateway confirms, or the payment step when the payment didn't happen.
const TOKEN = "5b0c7f0e-1111-4222-8333-944455556666";
const ORDER_TOKEN = "99999999-2222-4333-8444-555555555555";
const ok = (data: unknown) => ({ ok: true as const, data });
const operation = (doc: unknown) => /(?:mutation|query)\s+(\w+)/.exec(String(doc))?.[1] ?? "";

function answers(map: Record<string, unknown[]>) {
  const seen = new Map<string, number>();
  mutate.mockImplementation(async (doc: unknown) => {
    const name = operation(doc);
    const list = map[name];
    if (!list) throw new Error(`unexpected API call: ${name}`);
    const index = seen.get(name) ?? 0;
    seen.set(name, index + 1);
    return list[Math.min(index, list.length - 1)];
  });
}
const calls = (name: string) => mutate.mock.calls.filter(([doc]) => operation(doc) === name);

const checkout = (chargeStatus: string, pending: number[]) =>
  ok({
    checkout: {
      chargeStatus,
      transactions: pending.map((amount, i) => ({
        token: `00000000-0000-4000-8000-00000000000${i}`,
        chargePendingAmount: { amount },
      })),
    },
  });
const gone = ok({ checkout: null });
const processed = ok({
  transactionProcess: { transaction: null, transactionEvent: null, errors: [] },
});
const completed = ok({ checkoutComplete: { order: { id: "o1", token: ORDER_TOKEN }, errors: [] } });
const notCompleted = ok({
  checkoutComplete: { order: null, errors: [{ field: "quantity", code: "INSUFFICIENT_STOCK" }] },
});
const down = { ok: false as const, error: new Error("timeout") };

beforeEach(() => {
  mutate.mockReset();
  readCheckoutToken.mockReset().mockResolvedValue(TOKEN);
  clearCheckoutCookie.mockReset();
});

describe("settlePaymentReturn", () => {
  it("asks the gateway now, then makes (or finds) the order and clears the cookie", async () => {
    answers({
      CheckoutPaymentState: [checkout("NONE", [50000]), checkout("FULL", [0])],
      TransactionProcess: [processed],
      CheckoutComplete: [completed],
    });
    expect(await settlePaymentReturn()).toBe(`/order/${ORDER_TOKEN}`);
    expect(calls("TransactionProcess")[0]?.[1]).toEqual({
      variables: { token: "00000000-0000-4000-8000-000000000000" },
    });
    expect(clearCheckoutCookie).toHaveBeenCalledOnce();
  });

  it("finds the order the API already made (the checkout no longer reads)", async () => {
    answers({ CheckoutPaymentState: [gone], CheckoutComplete: [completed] });
    expect(await settlePaymentReturn()).toBe(`/order/${ORDER_TOKEN}`);
    expect(calls("TransactionProcess")).toHaveLength(0);
  });

  it("waits while the gateway hasn't confirmed the payment", async () => {
    answers({
      CheckoutPaymentState: [checkout("NONE", [50000])],
      TransactionProcess: [processed],
    });
    expect(await settlePaymentReturn()).toBe("/checkout/pending");
    expect(calls("CheckoutComplete")).toHaveLength(0);
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
  });

  it("goes back to the payment step when the payment expired or was abandoned", async () => {
    answers({
      CheckoutPaymentState: [checkout("NONE", [50000]), checkout("NONE", [0])],
      TransactionProcess: [processed],
    });
    expect(await settlePaymentReturn()).toBe("/checkout?step=payment&payment=expired");
  });

  it("tells the shopper when a paid checkout couldn't become an order (the API refunds it)", async () => {
    answers({ CheckoutPaymentState: [checkout("FULL", [])], CheckoutComplete: [notCompleted] });
    expect(await settlePaymentReturn()).toBe("/checkout?step=payment&payment=notCompleted");
    expect(clearCheckoutCookie).not.toHaveBeenCalled();
  });

  it("waits during an outage instead of guessing", async () => {
    answers({ CheckoutPaymentState: [down] });
    expect(await settlePaymentReturn()).toBe("/checkout/pending");
  });

  it("sends a shopper without a checkout to the cart", async () => {
    readCheckoutToken.mockResolvedValue(null);
    expect(await settlePaymentReturn()).toBe("/cart");
    expect(mutate).not.toHaveBeenCalled();
  });
});
