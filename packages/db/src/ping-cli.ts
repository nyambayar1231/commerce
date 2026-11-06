// `pnpm --filter @commerce/db db:ping` — checks that Postgres is reachable.
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "./client.ts";

const result = await getDb().execute<{ version: string }>(sql`select version()`);
console.log(result[0]?.version);
await closeDb();
