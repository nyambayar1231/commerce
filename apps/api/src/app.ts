import type { Db } from "@commerce/db";
import { createYoga } from "graphql-yoga";
import type { Context } from "./graphql/context.ts";
import { schema } from "./graphql/schema.ts";

// The GraphQL app as a request handler, with no HTTP server attached. server.ts serves it over
// HTTP; tests (M0.2.7) will call it directly.
export function createApp(db: Db) {
  return createYoga<Record<string, unknown>, Context>({
    schema,
    context: () => ({ db }),
  });
}
