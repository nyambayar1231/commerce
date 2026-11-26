import { createHmac } from "node:crypto";

// A small stand-in for Wire's API (docs.wire.mn, read 2026-11-26), because Wire has no test mode
// (ADR-0016 §10). It implements what our adapter calls — PaymentIntents, checkout sessions,
// charges, refunds, cancel — with Wire's idempotency (same key + same body → the first answer;
// different body → 409 idempotency_key_in_use), its error envelope, and signed webhooks. Tests
// play the shopper with `pay` and choose failures with `failNext`. It is a request handler, so
// unit tests call it as `fetch` and the e2e run serves it over HTTP.

type Intent = {
  id: string;
  object: "payment_intent";
  amount: number;
  currency: "MNT";
  status: string;
  metadata: Record<string, string>;
  expires_at: number;
  created: number;
};
type Charge = {
  id: string;
  object: "charge";
  payment_intent: string;
  status: "pending" | "succeeded" | "failed";
  amount: number;
  amount_refunded: number;
};
type Refund = {
  id: string;
  object: "refund";
  charge: string;
  amount: number;
  reason: string | null;
  status: "pending" | "succeeded" | "failed" | "manual_required";
};

export const FAKE_WIRE_KEY = "sk_live_fake_for_tests";
export const FAKE_WIRE_SECRET = "whsec_fake_for_tests";

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
const now = () => Math.floor(Date.now() / 1000);

export type FakeWire = ReturnType<typeof createFakeWire>;

export function createFakeWire(options: { checkoutBaseUrl?: string } = {}) {
  const intents = new Map<string, Intent>();
  const charges = new Map<string, Charge>();
  const refunds = new Map<string, Refund>();
  const replays = new Map<string, { body: string; status: number; response: unknown }>();
  const failures: { path: RegExp; status: number; code: string }[] = [];
  const requests: { method: string; path: string; body: unknown; idempotencyKey: string | null }[] =
    [];
  /** How refunds end: Wire's QPay refunds may be completed by hand (manual_required). */
  let refundOutcome: Refund["status"] = "succeeded";

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const error = (status: number, code: string, message = code) =>
    json(status, { error: { type: "invalid_request_error", code, message } });

  function route(method: string, path: string, body: Record<string, unknown>): [number, unknown] {
    if (method === "POST" && path === "/payment_intents") {
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount <= 0)
        return [400, { error: { code: "amount_too_small" } }];
      const intent: Intent = {
        id: id("pi"),
        object: "payment_intent",
        amount,
        currency: "MNT",
        status: "requires_payment_method",
        metadata: (body.metadata as Record<string, string>) ?? {},
        expires_at: Number(body.expires_at ?? now() + 3600),
        created: now(),
      };
      intents.set(intent.id, intent);
      return [200, intent];
    }
    if (method === "POST" && path === "/checkout/sessions") {
      const intent = intents.get(String(body.payment_intent));
      if (!intent) return [404, { error: { code: "resource_missing" } }];
      if (intent.status !== "requires_payment_method") {
        return [400, { error: { code: "payment_intent_unexpected_state" } }];
      }
      const sessionId = id("cs");
      return [
        200,
        {
          id: sessionId,
          object: "checkout_session",
          payment_intent: intent.id,
          status: "open",
          url: `${options.checkoutBaseUrl ?? "https://pay.wire.test"}/c/${sessionId}?pi=${intent.id}`,
          success_url: body.success_url ?? "",
          cancel_url: body.cancel_url ?? "",
        },
      ];
    }
    let match = /^\/payment_intents\/([^/]+)$/.exec(path);
    if (method === "GET" && match) {
      const intent = intents.get(decodeURIComponent(match[1] ?? ""));
      return intent ? [200, intent] : [404, { error: { code: "resource_missing" } }];
    }
    match = /^\/payment_intents\/([^/]+)\/cancel$/.exec(path);
    if (method === "POST" && match) {
      const intent = intents.get(decodeURIComponent(match[1] ?? ""));
      if (!intent) return [404, { error: { code: "resource_missing" } }];
      if (intent.status === "succeeded") {
        return [400, { error: { code: "payment_intent_unexpected_state" } }];
      }
      intent.status = "canceled";
      return [200, intent];
    }
    if (method === "GET" && path.startsWith("/charges?")) {
      const paymentIntent = new URLSearchParams(path.slice("/charges?".length)).get(
        "payment_intent",
      );
      const data = [...charges.values()].filter(
        (charge) => charge.payment_intent === paymentIntent,
      );
      return [200, { object: "list", url: "/v1/charges", has_more: false, data }];
    }
    if (method === "POST" && path === "/refunds") {
      const charge = charges.get(String(body.charge));
      if (!charge) return [404, { error: { code: "resource_missing" } }];
      const amount =
        body.amount === undefined ? charge.amount - charge.amount_refunded : Number(body.amount);
      if (charge.status !== "succeeded") return [400, { error: { code: "charge_not_refundable" } }];
      if (amount > charge.amount - charge.amount_refunded) {
        return [
          400,
          { error: { code: "amount_invalid", message: "More than the refundable amount" } },
        ];
      }
      charge.amount_refunded += amount;
      const refund: Refund = {
        id: id("re"),
        object: "refund",
        charge: charge.id,
        amount,
        reason: (body.reason as string) ?? null,
        status: refundOutcome,
      };
      refunds.set(refund.id, refund);
      return [200, refund];
    }
    match = /^\/refunds\/([^/]+)$/.exec(path);
    if (method === "GET" && match) {
      const refund = refunds.get(decodeURIComponent(match[1] ?? ""));
      return refund ? [200, refund] : [404, { error: { code: "resource_missing" } }];
    }
    return [404, { error: { code: "resource_missing", message: `${method} ${path}` } }];
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/v1/, "") + url.search;
    const method = request.method;
    const raw = method === "POST" ? await request.text() : "";
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const idempotencyKey = request.headers.get("idempotency-key");
    requests.push({ method, path, body, idempotencyKey });

    if (request.headers.get("authorization") !== `Bearer ${FAKE_WIRE_KEY}`) {
      return error(401, "invalid_api_key");
    }
    const failure = failures.findIndex((f) => f.path.test(path));
    if (failure >= 0) {
      const [f] = failures.splice(failure, 1);
      if (f) return error(f.status, f.code);
    }
    if (method === "POST") {
      if (!idempotencyKey) return error(400, "parameter_missing", "Idempotency-Key");
      const replay = replays.get(idempotencyKey);
      if (replay) {
        if (replay.body !== `${path}${raw}`) return error(409, "idempotency_key_in_use");
        return json(replay.status, replay.response);
      }
    }
    const [status, response] = route(method, path, body);
    if (method === "POST" && idempotencyKey && (status < 300 || status === 402)) {
      replays.set(idempotencyKey, { body: `${path}${raw}`, status, response });
    }
    return json(status, response);
  }

  return {
    /** Use as `fetch` (unit tests) or behind an HTTP server (e2e). */
    fetch: (input: string | URL | Request, init?: RequestInit) =>
      handle(input instanceof Request ? input : new Request(input, init)),
    handle,
    requests,
    intents,
    refunds,
    /** The shopper pays an intent on Wire's page: a succeeded charge. */
    pay(paymentIntentId: string, amount?: number) {
      const intent = intents.get(paymentIntentId);
      if (!intent) throw new Error(`fake Wire: no intent ${paymentIntentId}`);
      intent.status = "succeeded";
      const charge: Charge = {
        id: id("ch"),
        object: "charge",
        payment_intent: intent.id,
        status: "succeeded",
        amount: amount ?? intent.amount,
        amount_refunded: 0,
      };
      charges.set(charge.id, charge);
      if (amount !== undefined) intent.amount = amount;
      return charge;
    },
    expire(paymentIntentId: string) {
      const intent = intents.get(paymentIntentId);
      if (intent) intent.status = "canceled";
    },
    /** The next request whose path matches answers this error. */
    failNext(path: RegExp, status: number, code: string) {
      failures.push({ path, status, code });
    },
    setRefundOutcome(outcome: Refund["status"]) {
      refundOutcome = outcome;
    },
    finishRefund(refundId: string, status: "succeeded" | "failed") {
      const refund = refunds.get(refundId);
      if (refund) refund.status = status;
    },
    /** A webhook as Wire signs it. */
    webhook(type: string, data: Record<string, unknown>, at = now()) {
      const body = JSON.stringify({ id: id("evt"), object: "event", type, created: at, data });
      const v1 = createHmac("sha256", FAKE_WIRE_SECRET).update(`${at}.${body}`).digest("hex");
      return { body, signature: `t=${at},v1=${v1}` };
    },
  };
}
