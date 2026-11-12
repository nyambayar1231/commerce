import type { Db } from "@commerce/db";
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";
import { sql } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { createYoga, maskError, useReadinessCheck } from "graphql-yoga";
import { type Context, createContext } from "./graphql/context.ts";
import { schema } from "./graphql/schema.ts";
import { logger } from "./logger.ts";
import { thumbnailRoute } from "./thumbnailRoute.ts";

// The GraphQL app as a request handler, with no HTTP server attached. server.ts serves it over
// HTTP; tests (M0.2.7) will call it directly.
//
// Built into Yoga 6 and left at their defaults:
// - error masking: an unexpected error reaches the client only as "Unexpected error."; the
//   original error is logged on the server (we add its causes, see `maskedErrors` below).
// - request ids: each request gets one (or keeps a safe incoming `x-request-id`); it is added
//   to every log line and returned in the `x-request-id` response header.
//
// Logging and health (PLAN M9.2): Yoga writes through our logger (src/logger.ts, JSON lines in
// production). `/health/live` answers 200 while the process serves requests (Yoga's health check);
// `/health/ready` answers 200 only when the database answers too, 503 otherwise, so a load
// balancer stops sending traffic to an instance that can't serve it.
//
// CORS: only `allowedOrigins` may call the API from a browser, with credentials (the session
// cookie). Yoga's default would reflect any origin with credentials allowed.
export type AppOptions = { allowedOrigins: string[] };

export function createApp(db: Db, { allowedOrigins }: AppOptions) {
  // Explicit origins only. (whatwg-node's own list handling treats [] as "allow all" and echoes a
  // single listed origin to every caller, so the check below is done here instead.)
  if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
    throw new Error("allowedOrigins must list explicit origins");
  }
  // Cookies resolvers set during a request, written onto its response by the plugin below.
  const cookiesByRequest = new WeakMap<Request, string[]>();

  return createYoga<Record<string, unknown>, Context>({
    schema,
    logging: logger,
    healthCheckEndpoint: "/health/live",
    // The multipart body of a product image upload is buffered by the request parser before our
    // 10 MiB check runs (modules/catalog/mediaFile.ts); cap the body just above it so a huge
    // request is rejected with 413 instead of being read. Yoga's default is 25 MB.
    maxRequestBodySize: 11 * 1024 * 1024,
    context: async ({ request }) => {
      const cookies: string[] = [];
      cookiesByRequest.set(request, cookies);
      return { ...(await createContext(db, request)), setCookie: (c) => cookies.push(c) };
    },
    cors: (request) => {
      const origin = request.headers.get("origin");
      return origin !== null && allowedOrigins.includes(origin)
        ? { origin, credentials: true }
        : false;
    },
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
      useReadinessCheck({
        endpoint: "/health/ready",
        check: async () => {
          try {
            await db.execute(sql`select 1`);
            return true;
          } catch (error) {
            // A 503 without the reason: the error stays in the log, not in a public response.
            logger.warn({ err: error }, "Readiness check failed");
            return false;
          }
        },
      }),
      // The image endpoint (ADR-0014) is anonymous and answers before every GraphQL concern;
      // placing it before CSRF is what lets an image URL be used without the CSRF header.
      thumbnailRoute(db),
      // CSRF: rejects requests a browser could send cross-site without a CORS preflight
      // (GET, or POST with a form/text content type) unless they carry this header.
      useCSRFPrevention({ requestHeaders: ["x-graphql-yoga-csrf"] }),
      {
        onResponse: ({ request, response }) => {
          for (const cookie of cookiesByRequest.get(request) ?? []) {
            response.headers.append("set-cookie", cookie);
          }
        },
      },
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
