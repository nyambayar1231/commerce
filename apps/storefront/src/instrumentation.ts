import type { Instrumentation } from "next";

// Runs once when the server starts: a bad configuration stops the process here (exit code 1).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/lib/env");
    try {
      getEnv();
    } catch (error) {
      // Next would keep listening and answer 500 to everything; stop the process instead.
      const { log } = await import("@/lib/log");
      log.error("invalid-configuration", {
        message: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  }
}

// Next's own report of a failed request. Only the path (no query), method, route type and the
// message are logged: never headers or cookies.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("@/lib/log");
  log.error("request-error", {
    path: request.path.split("?")[0],
    method: request.method,
    routeType: context.routeType,
    message: error instanceof Error ? error.message : String(error),
  });
};
