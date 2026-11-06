import { createServer } from "node:http";
import { closeDb, getDb } from "@commerce/db";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 4000);
const server = createServer(createApp(getDb()));

server.listen(port, () => {
  console.log(`GraphQL API on http://localhost:${port}/graphql`);
});

// Stop accepting requests, then close the database pool so the process can exit.
function shutdown() {
  server.close(() => void closeDb());
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
