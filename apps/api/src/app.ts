import type { Db } from "@commerce/db";
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";
import { GraphQLError } from "graphql";
import { createYoga, maskError } from "graphql-yoga";
import type { Context } from "./graphql/context.ts";
import { schema } from "./graphql/schema.ts";

// The GraphQL app as a request handler, with no HTTP server attached. server.ts serves it over
// HTTP; tests (M0.2.7) will call it directly.
//
// Built into Yoga 6 and left at their defaults:
// - error masking: an unexpected error reaches the client only as "Unexpected error."; the
//   original error is logged on the server (we add its causes, see `maskedErrors` below).
// - request ids: each request gets one (or keeps a safe incoming `x-request-id`); it is added
//   to every log line and returned in the `x-request-id` response header.
export function createApp(db: Db) {
  return createYoga<Record<string, unknown>, Context>({
    schema,
    context: () => ({ db }),
    maskedErrors: {
      // Yoga's default masking, plus one log line with the error's causes: Yoga logs the masked
      // error but not its `cause` chain, which is where the real reason lives (Drizzle's
      // "Failed query: …" wraps the driver's error, e.g. ECONNREFUSED).
      maskError: (error, message, isDev, context) => {
        const masked = maskError(error, message, isDev);
        if (masked !== error) {
          context?.log?.error({ causes: causeChain(error) }, "Unexpected error causes");
        }
        return masked;
      },
    },
    plugins: [
      // CSRF: rejects requests a browser could send cross-site without a CORS preflight
      // (GET, or POST with a form/text content type) unless they carry this header.
      useCSRFPrevention({ requestHeaders: ["x-graphql-yoga-csrf"] }),
    ],
  });
}

// Messages of the errors underneath `error`: GraphQL's `originalError`, then each `cause`.
function causeChain(error: unknown): string[] {
  const messages: string[] = [];
  let current = error instanceof GraphQLError ? error.originalError : error;
  while (current instanceof Error && messages.length < 10) {
    const text = current.message || current.name; // some driver errors have an empty message
    const code = (current as { code?: unknown }).code;
    messages.push(typeof code === "string" ? `${text} [${code}]` : text);
    current = current.cause;
  }
  return messages;
}
