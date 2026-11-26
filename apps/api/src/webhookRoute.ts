import type { Db } from "@commerce/db";
import type { Plugin } from "graphql-yoga";
import { logger } from "./logger.ts";
import { type GatewayRegistry, handleWireWebhook } from "./modules/payments/index.ts";

// Payment gateway notifications (ADR-0016 §3): `POST /webhooks/wire`. Outside GraphQL and before
// the CSRF plugin (a gateway can't send our CSRF header); the signature is the authentication.
// Without Wire configured the route doesn't exist (404).

const WIRE_PATH = "/webhooks/wire";
/** Wire's notifications are small; anything bigger isn't one. */
const MAX_BODY_BYTES = 64 * 1024;

const text = (body: string, status: number, extra: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...extra },
  });

export function webhookRoute(
  db: Db,
  gateways: GatewayRegistry,
  wireWebhookSecret: string | null,
): Plugin {
  return {
    async onRequest({ request, url, endResponse }) {
      if (url.pathname !== WIRE_PATH) return;
      if (wireWebhookSecret === null) {
        endResponse(text("Not found", 404));
        return;
      }
      if (request.method !== "POST") {
        endResponse(text("Method not allowed", 405, { allow: "POST" }));
        return;
      }
      const length = Number(request.headers.get("content-length") ?? "0");
      if (length > MAX_BODY_BYTES) {
        endResponse(text("Payload too large", 413));
        return;
      }
      const rawBody = await request.text();
      if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
        endResponse(text("Payload too large", 413));
        return;
      }
      try {
        const result = await handleWireWebhook(
          db,
          gateways,
          wireWebhookSecret,
          rawBody,
          request.headers.get("wirepayment-signature"),
        );
        endResponse(text(result.body, result.status));
      } catch (error) {
        // Not even stored: a 5xx makes Wire deliver it again.
        logger.error({ err: error }, "Wire notification could not be stored");
        endResponse(text("Internal error", 500));
      }
    },
  };
}
