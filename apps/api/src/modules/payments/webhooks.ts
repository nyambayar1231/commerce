import { type Executor, schema } from "@commerce/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../../logger.ts";
import type { GatewayRegistry } from "./gateways/registry.ts";
import { verifyWireWebhook, WIRE_GATEWAY_ID } from "./gateways/wire.ts";
import { applyGatewayStatus, recordRefundOutcome } from "./transactions.ts";

// Gateway notifications (ADR-0016 §3–4). A notification is only a hint that something changed:
// it is verified, stored as received (the contract's 1-year evidence), and then the payment is
// read again from the gateway — the webhook body itself is never trusted for amounts or status.
// Wire is answered 2xx once the notification is stored; if processing fails, the reconciliation
// job finishes it (it re-reads every unfinished payment and refund).

export type WebhookResponse = { status: number; body: string };

const ok = (body = "ok"): WebhookResponse => ({ status: 200, body });

/** Stores the notification once; false when it was already stored (a redelivery). */
async function storeEvent(
  db: Executor,
  values: {
    provider: string;
    externalEventId: string;
    type: string;
    rawBody: string;
    signature: string;
  },
): Promise<string | null> {
  const [row] = await db
    .insert(schema.paymentGatewayEvent)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: schema.paymentGatewayEvent.id });
  return row?.id ?? null;
}

async function markProcessed(db: Executor, id: string, error: unknown) {
  await db
    .update(schema.paymentGatewayEvent)
    .set({
      processedAt: sql`now()`,
      processingError: error === null ? "" : error instanceof Error ? error.message : String(error),
    })
    .where(eq(schema.paymentGatewayEvent.id, id));
}

/** `POST /webhooks/wire`. */
export async function handleWireWebhook(
  db: Executor,
  gateways: GatewayRegistry,
  webhookSecret: string,
  rawBody: string,
  signatureHeader: string | null,
): Promise<WebhookResponse> {
  const event = verifyWireWebhook(rawBody, signatureHeader, webhookSecret);
  if (!event) return { status: 400, body: "invalid signature" };
  // Wire's activation ping for a new endpoint: a 2xx turns the endpoint on.
  if (event.type === "endpoint.verification") return ok();

  const storedId = await storeEvent(db, {
    provider: WIRE_GATEWAY_ID,
    externalEventId: event.id,
    type: event.type,
    rawBody,
    signature: signatureHeader ?? "",
  });
  if (storedId === null) return ok("duplicate");

  try {
    if (event.type.startsWith("payment_intent.") && event.data.object === "payment_intent") {
      const [transaction] = await db
        .select({ id: schema.paymentTransaction.id })
        .from(schema.paymentTransaction)
        .where(
          and(
            eq(schema.paymentTransaction.provider, WIRE_GATEWAY_ID),
            eq(schema.paymentTransaction.pspReference, event.data.id),
          ),
        );
      if (transaction) await applyGatewayStatus(db, gateways, transaction.id);
      else logger.warn({ eventId: event.id }, "Wire notification for an unknown payment");
    } else if (event.type === "charge.refunded" && event.data.object === "refund") {
      await settleRefund(db, gateways, event.data.id);
    }
    await markProcessed(db, storedId, null);
  } catch (error) {
    logger.error({ err: error, eventId: event.id }, "Processing a Wire notification failed");
    await markProcessed(db, storedId, error);
  }
  return ok();
}

/** A refund Wire finished: its INFO answer (accepted, not done) is settled with what Wire reports. */
async function settleRefund(db: Executor, gateways: GatewayRegistry, refundReference: string) {
  const [pending] = await db
    .select({
      transactionId: schema.paymentEvent.transactionId,
      requestEventId: schema.paymentEvent.requestEventId,
    })
    .from(schema.paymentEvent)
    .where(
      and(
        eq(schema.paymentEvent.type, "INFO"),
        eq(schema.paymentEvent.pspReference, refundReference),
      ),
    );
  // A refund recorded as succeeded at once, or one whose answer we never stored (the
  // reconciliation job asks again with the same key): nothing to settle here.
  if (!pending?.requestEventId) return;
  const gateway = gateways.forTransaction(WIRE_GATEWAY_ID);
  if (!gateway?.fetchRefund) return;
  const result = await gateway.fetchRefund(refundReference);
  if (result.status === "succeeded" || result.status === "failed") {
    await recordRefundOutcome(db, pending.transactionId, pending.requestEventId, result);
  }
}
