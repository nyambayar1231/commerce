import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Rate-limit counters and blocks (PLAN M9.3, owner decision 2: Postgres, no Redis). Owned by the
// API's `rateLimit` module. One row per key, the way Saleor uses its cache: a counter
// (`login:fail:ip:<ip>`) or a block (`login:block:ip:<ip>`, `count` 0). A row whose `expires_at`
// has passed counts as absent; the next write to its key starts it again.
export const rateLimit = pgTable(
  "rate_limit",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // Deleting expired rows scans this instead of the table.
    index("rate_limit_expires_at_idx").on(table.expiresAt),
    check("rate_limit_count_not_negative", sql`${table.count} >= 0`),
  ],
);
