import { beforeEach, describe, expect, it } from "vitest";
import {
  createFakeWire,
  FAKE_WIRE_KEY,
  FAKE_WIRE_SECRET,
  type FakeWire,
} from "../../../../test/fakeWire.ts";
import { GatewayUnavailableError } from "./types.ts";
import {
  createWireGateway,
  readWireConfig,
  verifyWireWebhook,
  WIRE_PAYMENT_WINDOW_MS,
} from "./wire.ts";

// The Wire adapter against the fake Wire API (ADR-0016 §10): the requests it sends, how it reads
// Wire's answers and errors, and webhook signatures.
let wire: FakeWire;
let gateway: ReturnType<typeof createWireGateway>;
const NOW = new Date("2026-11-26T12:00:00Z");

beforeEach(() => {
  wire = createFakeWire();
  gateway = createWireGateway(
    { apiKey: FAKE_WIRE_KEY, webhookSecret: FAKE_WIRE_SECRET, apiUrl: "https://api.wire.test/v1" },
    { fetchImpl: wire.fetch, now: () => NOW },
  );
});

const start = (transactionId = "tx-1", returnUrl: string | null = "https://shop.mn/return") =>
  gateway.initialize({
    transactionId,
    amount: 45000,
    currency: "MNT",
    action: "CHARGE",
    gatewayData: null,
    returnUrl,
  });

describe("readWireConfig", () => {
  const base = { WIRE_API_KEY: "sk_live_abc", WIRE_WEBHOOK_SECRET: "whsec_abc" };

  it("reads the key, the secret and Wire's URL", () => {
    expect(readWireConfig(base)).toEqual({
      apiKey: "sk_live_abc",
      webhookSecret: "whsec_abc",
      apiUrl: "https://api.wire.mn/v1",
    });
  });

  it("lists every problem", () => {
    expect(() => readWireConfig({})).toThrow(
      /WIRE_API_KEY is not set.*WIRE_WEBHOOK_SECRET is not set/,
    );
    expect(() => readWireConfig({ ...base, WIRE_API_KEY: "sk_test_abc" })).toThrow(/test key/);
    expect(() => readWireConfig({ ...base, NODE_ENV: "production", WIRE_API_KEY: "abc" })).toThrow(
      /live secret key/,
    );
    expect(() =>
      readWireConfig({ ...base, NODE_ENV: "production", WIRE_API_URL: "http://localhost:1" }),
    ).toThrow(/https URL/);
    expect(readWireConfig({ ...base, WIRE_API_URL: "http://localhost:4099/v1/" }).apiUrl).toBe(
      "http://localhost:4099/v1",
    );
  });
});

describe("Wire gateway", () => {
  it("opens a 15-minute payment and its hosted page, keyed by our transaction", async () => {
    const result = await start();
    expect(result).toMatchObject({ kind: "action_required" });
    if (result.kind !== "action_required") return;
    expect(result.pspReference).toMatch(/^pi_/);
    expect(result.url).toMatch(/^https:\/\/pay\.wire\.test\/c\/cs_/);
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + WIRE_PAYMENT_WINDOW_MS));

    const [create, session] = wire.requests;
    expect(create).toEqual({
      method: "POST",
      path: "/payment_intents",
      idempotencyKey: "tx-1:payment_intent",
      body: {
        amount: 45000,
        currency: "MNT",
        expires_at: Math.floor(NOW.getTime() / 1000) + 15 * 60,
        metadata: { transaction_id: "tx-1" },
      },
    });
    expect(session).toMatchObject({
      path: "/checkout/sessions",
      idempotencyKey: "tx-1:checkout_session",
      body: {
        payment_intent: result.pspReference,
        success_url: "https://shop.mn/return",
        cancel_url: "https://shop.mn/return",
      },
    });
  });

  it("gets the same payment back when retried after a crash", async () => {
    const first = await start();
    const again = await start();
    expect(again).toEqual(first);
    expect(wire.intents.size).toBe(1);
  });

  it("refuses AUTHORIZATION and other currencies", async () => {
    expect(gateway.validate?.("AUTHORIZATION", null)).toMatch(/CHARGE/);
    expect(
      await gateway.initialize({
        transactionId: "tx-2",
        amount: 10,
        currency: "USD",
        action: "CHARGE",
        gatewayData: null,
        returnUrl: null,
      }),
    ).toMatchObject({ kind: "failure" });
  });

  it("turns Wire's definite refusals into failures and outages into retries", async () => {
    wire.failNext(/^\/payment_intents$/, 403, "connector_required");
    expect(await start("tx-a")).toMatchObject({
      kind: "failure",
      message: expect.stringContaining("connector_required"),
    });

    for (const [status, code] of [
      [503, "service_unavailable"],
      [429, "rate_limited"],
      [424, "operator_error"],
      [409, "idempotency_in_flight"],
    ] as const) {
      wire.failNext(/^\/payment_intents$/, status, code);
      await expect(start(`tx-${status}`)).rejects.toBeInstanceOf(GatewayUnavailableError);
    }

    const offline = createWireGateway(
      { apiKey: FAKE_WIRE_KEY, webhookSecret: FAKE_WIRE_SECRET, apiUrl: "http://127.0.0.1:9/v1" },
      {
        fetchImpl: async () => {
          throw new TypeError("fetch failed");
        },
      },
    );
    await expect(offline.fetchStatus("pi_x")).rejects.toBeInstanceOf(GatewayUnavailableError);
  });

  it("reads a payment's status, with the charge once paid", async () => {
    const started = await start();
    if (started.kind !== "action_required") throw new Error("not started");
    expect(await gateway.fetchStatus(started.pspReference)).toMatchObject({
      status: "action_required",
      amount: 45000,
      chargeReference: null,
    });
    const charge = wire.pay(started.pspReference);
    expect(await gateway.fetchStatus(started.pspReference)).toEqual({
      status: "succeeded",
      amount: 45000,
      chargeReference: charge.id,
      message: "",
    });
  });

  it("reports an expired payment as canceled", async () => {
    const started = await start();
    if (started.kind !== "action_required") throw new Error("not started");
    wire.expire(started.pspReference);
    expect((await gateway.fetchStatus(started.pspReference)).status).toBe("canceled");
  });

  it("refunds the charge, finding it when we don't know it yet", async () => {
    const started = await start();
    if (started.kind !== "action_required") throw new Error("not started");
    const charge = wire.pay(started.pspReference);

    const refund = await gateway.refund({
      pspReference: started.pspReference,
      chargeReference: null,
      amount: 5000,
      currency: "MNT",
      idempotencyKey: "refund-1",
      reason: "Damaged",
    });
    expect(refund).toMatchObject({ status: "succeeded", message: "" });
    expect(wire.requests.at(-1)).toMatchObject({
      path: "/refunds",
      idempotencyKey: "refund-1",
      body: { charge: charge.id, amount: 5000, reason: "Damaged" },
    });

    wire.setRefundOutcome("manual_required");
    const manual = await gateway.refund({
      pspReference: started.pspReference,
      chargeReference: charge.id,
      amount: 5000,
      currency: "MNT",
      idempotencyKey: "refund-2",
      reason: "",
    });
    expect(manual.status).toBe("manual_required");
    wire.finishRefund(manual.refundReference, "succeeded");
    expect((await gateway.fetchRefund?.(manual.refundReference))?.status).toBe("succeeded");

    expect(
      await gateway.refund({
        pspReference: started.pspReference,
        chargeReference: charge.id,
        amount: 99999,
        currency: "MNT",
        idempotencyKey: "refund-3",
        reason: "",
      }),
    ).toMatchObject({ status: "failed", message: expect.stringContaining("amount_invalid") });
  });

  it("cancels an unpaid payment, and leaves a paid one to the status read", async () => {
    const started = await start();
    if (started.kind !== "action_required") throw new Error("not started");
    await gateway.cancel(started.pspReference);
    expect((await gateway.fetchStatus(started.pspReference)).status).toBe("canceled");

    const paid = await start("tx-paid");
    if (paid.kind !== "action_required") throw new Error("not started");
    wire.pay(paid.pspReference);
    await expect(gateway.cancel(paid.pspReference)).resolves.toBeUndefined();
    expect((await gateway.fetchStatus(paid.pspReference)).status).toBe("succeeded");
  });
});

describe("verifyWireWebhook", () => {
  it("accepts Wire's signature over the raw body", () => {
    const { body, signature } = wire.webhook("payment_intent.succeeded", { id: "pi_1" });
    expect(verifyWireWebhook(body, signature, FAKE_WIRE_SECRET)).toMatchObject({
      type: "payment_intent.succeeded",
      data: { id: "pi_1" },
    });
  });

  it("refuses a wrong secret, a changed body, an old or future timestamp and junk", () => {
    const { body, signature } = wire.webhook("payment_intent.succeeded", { id: "pi_1" });
    expect(verifyWireWebhook(body, signature, "whsec_other")).toBeNull();
    expect(verifyWireWebhook(body.replace("pi_1", "pi_2"), signature, FAKE_WIRE_SECRET)).toBeNull();
    const old = wire.webhook(
      "payment_intent.succeeded",
      { id: "pi_1" },
      Math.floor(Date.now() / 1000) - 301,
    );
    expect(verifyWireWebhook(old.body, old.signature, FAKE_WIRE_SECRET)).toBeNull();
    const future = wire.webhook(
      "payment_intent.succeeded",
      { id: "pi_1" },
      Math.floor(Date.now() / 1000) + 301,
    );
    expect(verifyWireWebhook(future.body, future.signature, FAKE_WIRE_SECRET)).toBeNull();
    for (const header of [null, "", "t=1", "v1=ab", "t=x,v1=ab", "garbage"]) {
      expect(verifyWireWebhook(body, header, FAKE_WIRE_SECRET)).toBeNull();
    }
  });
});
