import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  GatewayPaymentStatus,
  InitializeResult,
  PaymentGateway,
  RefundResult,
} from "./types.ts";
import { GatewayUnavailableError } from "./types.ts";

// Wire (wire.mn), the first real gateway (ADR-0016): QPay through Wire's PaymentIntent API and its
// hosted checkout page, read from docs.wire.mn on 2026-11-26. JSON bodies, whole-tögrög integer
// amounts (our MNT minor units, ADR-0013), `Idempotency-Key` on every POST (Wire replays a key's
// first 2xx/402 answer for 48 hours). Wire has no test mode: tests point WIRE_API_URL at a fake.
//
// Unknown outcome (network error, timeout, 5xx, 408, 409 idempotency_in_flight, 424, 429) →
// GatewayUnavailableError: the caller keeps its request and retries with the same key. Any other
// 4xx is Wire's answer and becomes a failure with Wire's message.

export const WIRE_GATEWAY_ID = "mn.wire.payment";
const WIRE_DEFAULT_URL = "https://api.wire.mn/v1";
/** The shopper has this long to pay on Wire's page (ADR-0016 §7). */
export const WIRE_PAYMENT_WINDOW_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
/** A webhook older than this is refused (Wire's own rule). */
const SIGNATURE_TOLERANCE_SECONDS = 300;

type Env = Record<string, string | undefined>;

export type WireConfig = { apiKey: string; webhookSecret: string; apiUrl: string };

/**
 * WIRE_API_KEY (a live secret key, `sk_live_…`), WIRE_WEBHOOK_SECRET (`whsec_…`) and
 * WIRE_API_URL (default Wire's API; an http URL only outside production, for a fake server).
 * Throws with every problem.
 */
export function readWireConfig(env: Env = process.env): WireConfig {
  const problems: string[] = [];
  const apiKey = env.WIRE_API_KEY?.trim() ?? "";
  const webhookSecret = env.WIRE_WEBHOOK_SECRET?.trim() ?? "";
  const apiUrl = (env.WIRE_API_URL?.trim() || WIRE_DEFAULT_URL).replace(/\/+$/, "");
  if (!apiKey) problems.push("WIRE_API_KEY is not set (Wire dashboard → API key)");
  else if (apiKey.startsWith("sk_test_")) {
    problems.push("WIRE_API_KEY is a test key; Wire accepts only live keys (sk_live_…)");
  } else if (!apiKey.startsWith("sk_live_") && env.NODE_ENV === "production") {
    problems.push("WIRE_API_KEY must be a live secret key (sk_live_…)");
  }
  if (!webhookSecret) {
    problems.push("WIRE_WEBHOOK_SECRET is not set (shown once when the webhook endpoint is made)");
  }
  try {
    const url = new URL(apiUrl);
    const httpsOnly = env.NODE_ENV === "production";
    if (url.protocol !== "https:" && (httpsOnly || url.protocol !== "http:")) {
      throw new Error();
    }
  } catch {
    problems.push(
      `WIRE_API_URL must be an ${env.NODE_ENV === "production" ? "https" : "http(s)"} URL`,
    );
  }
  if (problems.length > 0) throw new Error(problems.join("; "));
  return { apiKey, webhookSecret, apiUrl };
}

// ── Wire's objects (only the fields we read) ─────────────────────────────────────────────────

type WirePaymentIntent = {
  id: string;
  object: "payment_intent";
  amount: number;
  currency: string;
  status:
    | "new"
    | "requires_payment_method"
    | "requires_action"
    | "requires_capture"
    | "processing"
    | "succeeded"
    | "canceled";
  expires_at: number | null;
};
type WireCheckoutSession = { id: string; object: "checkout_session"; url: string };
type WireCharge = {
  id: string;
  payment_intent: string;
  status: "pending" | "succeeded" | "failed";
};
type WireRefund = {
  id: string;
  object: "refund";
  status: "pending" | "succeeded" | "failed" | "manual_required";
};
type WireList<T> = { object: "list"; data: T[]; has_more: boolean };
type WireError = { error?: { type?: string; code?: string; message?: string; param?: string } };

/** A definite answer from Wire that isn't a success (a 4xx we shouldn't retry). */
export class WireRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "WireRequestError";
    this.status = status;
    this.code = code;
  }
}

const RETRYABLE_STATUSES = new Set([408, 424, 425, 429]);

export type WireFetch = typeof fetch;

/** One call to Wire's API. */
async function wireRequest<T>(
  config: WireConfig,
  method: "GET" | "POST",
  path: string,
  options: { body?: object; idempotencyKey?: string; fetchImpl?: WireFetch } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`,
    accept: "application/json",
  };
  if (method === "POST") {
    headers["content-type"] = "application/json";
    if (!options.idempotencyKey) throw new Error(`Wire ${path}: POST needs an Idempotency-Key`);
    headers["idempotency-key"] = options.idempotencyKey;
  }
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(`${config.apiUrl}${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GatewayUnavailableError(WIRE_GATEWAY_ID, `${method} ${path} failed`, {
      cause: error,
    });
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = text === "" ? null : JSON.parse(text);
  } catch {
    body = null;
  }
  if (response.ok) return body as T;

  const error = (body as WireError | null)?.error;
  const code = error?.code ?? "";
  const message = error?.message || `Wire answered ${response.status}`;
  if (
    response.status >= 500 ||
    RETRYABLE_STATUSES.has(response.status) ||
    (response.status === 409 && code === "idempotency_in_flight")
  ) {
    throw new GatewayUnavailableError(
      WIRE_GATEWAY_ID,
      `${method} ${path}: ${response.status} ${code} ${message}`,
    );
  }
  throw new WireRequestError(response.status, code, message);
}

const unixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

/** Maps a PaymentIntent's status to ours (Wire has no "failed": a failed attempt waits again). */
function statusOf(intent: WirePaymentIntent): GatewayPaymentStatus["status"] {
  switch (intent.status) {
    case "succeeded":
      return "succeeded";
    case "canceled":
      return "canceled";
    case "processing":
    case "requires_capture":
      return "pending";
    default:
      return "action_required";
  }
}

export type WireGatewayOptions = {
  fetchImpl?: WireFetch;
  /** "Now", for tests. */
  now?: () => Date;
};

export function createWireGateway(
  config: WireConfig,
  options: WireGatewayOptions = {},
): PaymentGateway {
  const now = options.now ?? (() => new Date());
  const request = <T>(
    method: "GET" | "POST",
    path: string,
    extra: { body?: object; idempotencyKey?: string } = {},
  ) => wireRequest<T>(config, method, path, { ...extra, fetchImpl: options.fetchImpl });

  /** The succeeded charge of a payment: what Wire refunds. */
  async function succeededCharge(paymentIntentId: string): Promise<string | null> {
    const charges = await request<WireList<WireCharge>>(
      "GET",
      `/charges?payment_intent=${encodeURIComponent(paymentIntentId)}`,
    );
    return charges.data.find((charge) => charge.status === "succeeded")?.id ?? null;
  }

  return {
    id: WIRE_GATEWAY_ID,
    name: "Wire (QPay)",
    settlesLater: true,

    validate(action) {
      return action === "CHARGE" ? null : "Wire takes payments at once; use the CHARGE action.";
    },

    async initialize({ transactionId, amount, currency, returnUrl }): Promise<InitializeResult> {
      if (currency !== "MNT") {
        return { kind: "failure", message: `Wire takes MNT only, not ${currency}.` };
      }
      const expiresAt = new Date(now().getTime() + WIRE_PAYMENT_WINDOW_MS);
      try {
        // Our transaction id makes both calls idempotent: a retry after a crash gets the same
        // payment and the same page back (Wire keeps the answers 48 hours).
        const intent = await request<WirePaymentIntent>("POST", "/payment_intents", {
          idempotencyKey: `${transactionId}:payment_intent`,
          body: {
            amount,
            currency: "MNT",
            expires_at: unixSeconds(expiresAt),
            metadata: { transaction_id: transactionId },
          },
        });
        const session = await request<WireCheckoutSession>("POST", "/checkout/sessions", {
          idempotencyKey: `${transactionId}:checkout_session`,
          body: {
            payment_intent: intent.id,
            ...(returnUrl ? { success_url: returnUrl, cancel_url: returnUrl } : {}),
          },
        });
        return {
          kind: "action_required",
          pspReference: intent.id,
          url: session.url,
          expiresAt: intent.expires_at ? new Date(intent.expires_at * 1000) : expiresAt,
        };
      } catch (error) {
        if (error instanceof WireRequestError) {
          return { kind: "failure", message: `${error.message} (${error.code || error.status})` };
        }
        throw error;
      }
    },

    async fetchStatus(pspReference) {
      const intent = await request<WirePaymentIntent>(
        "GET",
        `/payment_intents/${encodeURIComponent(pspReference)}`,
      );
      const status = statusOf(intent);
      return {
        status,
        amount: intent.amount,
        chargeReference: status === "succeeded" ? await succeededCharge(intent.id) : null,
        message: status === "canceled" ? "Canceled or expired unpaid at Wire." : "",
      };
    },

    async refund({ pspReference, chargeReference, amount, idempotencyKey, reason }) {
      const charge = chargeReference ?? (await succeededCharge(pspReference));
      if (!charge) {
        return {
          status: "failed",
          refundReference: "",
          message: "Wire has no paid charge to refund.",
        };
      }
      try {
        const refund = await request<WireRefund>("POST", "/refunds", {
          idempotencyKey,
          body: { charge, amount, ...(reason ? { reason: reason.slice(0, 200) } : {}) },
        });
        return { status: refund.status, refundReference: refund.id, message: "" };
      } catch (error) {
        if (error instanceof WireRequestError) {
          return {
            status: "failed",
            refundReference: "",
            message: `${error.message} (${error.code || error.status})`,
          };
        }
        throw error;
      }
    },

    async fetchRefund(refundReference): Promise<RefundResult> {
      const refund = await request<WireRefund>(
        "GET",
        `/refunds/${encodeURIComponent(refundReference)}`,
      );
      return { status: refund.status, refundReference: refund.id, message: "" };
    },

    async cancel(pspReference) {
      try {
        await request<WirePaymentIntent>(
          "POST",
          `/payment_intents/${encodeURIComponent(pspReference)}/cancel`,
          { idempotencyKey: `${pspReference}:cancel` },
        );
      } catch (error) {
        // Already paid (or changed meanwhile): the caller reads the status next.
        if (error instanceof WireRequestError && error.code === "payment_intent_unexpected_state") {
          return;
        }
        throw error;
      }
    },
  };
}

// ── Webhooks ─────────────────────────────────────────────────────────────────────────────────

export type WireEvent = {
  id: string;
  object: "event";
  type: string;
  created: number;
  data: { id: string; object: string; status?: string; amount?: number; charge?: string };
};

/**
 * Checks `WirePayment-Signature: t=<unix>,v1=<hex>` against the raw body:
 * v1 = hex(HMAC_SHA256(secret, t + "." + rawBody)), with `t` at most 5 minutes from now (either
 * way). Returns the parsed event, or null for anything that doesn't verify.
 */
export function verifyWireWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  now: Date = new Date(),
): WireEvent | null {
  if (!signatureHeader || !secret) return null;
  const parts = new Map<string, string>();
  for (const part of signatureHeader.split(",")) {
    const index = part.indexOf("=");
    if (index > 0) parts.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[0-9a-f]+$/i.test(signature)) {
    return null;
  }
  if (Math.abs(unixSeconds(now) - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return null;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const given = Buffer.from(signature.toLowerCase());
  if (given.length !== expected.length || !timingSafeEqual(given, Buffer.from(expected))) {
    return null;
  }
  try {
    const event = JSON.parse(rawBody) as WireEvent;
    if (typeof event?.id !== "string" || typeof event?.type !== "string") return null;
    return event;
  } catch {
    return null;
  }
}
