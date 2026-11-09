import { createServer } from "node:http";
import { closeDb, getDb } from "@commerce/db";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 4000);
// Browser origins allowed to call the API (comma-separated; Saleor's variable name). Defaults to
// the dashboard's Vite dev server.
const allowedOrigins = (process.env.ALLOWED_GRAPHQL_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin !== "");
const server = createServer(createApp(getDb(), { allowedOrigins }));

server.listen(port, () => {
  console.log(`GraphQL API on http://localhost:${port}/graphql`);
});

// Stop accepting requests, then close the database pool so the process can exit.
function shutdown() {
  server.close(() => void closeDb());
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
