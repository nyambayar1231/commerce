import { createServer } from "node:http";
import { closeDb, getDb } from "@commerce/db";
import { createApp } from "./app.ts";
import { assertConfig } from "./config.ts";
import { logger } from "./logger.ts";
import { stopJobQueue } from "./modules/jobs/index.ts";

// Fail at start with every configuration problem listed (PLAN M9.1).
assertConfig("api");

const port = Number(process.env.PORT ?? 4000);
// Browser origins allowed to call the API (comma-separated; Saleor's variable name). Defaults to
// the dashboard's Vite dev server.
const allowedOrigins = (process.env.ALLOWED_GRAPHQL_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin !== "");
const server = createServer(createApp(getDb(), { allowedOrigins }));

server.listen(port, () => {
  logger.info({ port }, `GraphQL API on http://localhost:${port}/graphql`);
});

// Stop accepting requests, then close pg-boss's and the database's pools so the process can exit.
function shutdown() {
  server.close(() => void stopJobQueue().finally(() => void closeDb()));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
