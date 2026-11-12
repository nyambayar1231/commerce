import { ConsoleLogWriter, JSONLogWriter, Logger } from "@graphql-hive/logger";

// The process's logger (PLAN M9.2, owner decision 2026-11-12): the one Yoga 6 already uses, so
// GraphQL request logs (with their request id) and our own lines share one format. JSON lines in
// production or with LOG_JSON=true (one object per line: level, msg, timestamp, attributes);
// readable console output in dev. LOG_LEVEL (trace|debug|info|warn|error) sets the minimum level.
// Log an error as an attribute — `logger.error({ err }, "What failed")` — so its stack and
// `cause` chain are written too.

const json =
  process.env.NODE_ENV === "production" || /^(1|true|yes)$/i.test(process.env.LOG_JSON ?? "");

export const logger = new Logger({
  writers: [json ? new JSONLogWriter() : new ConsoleLogWriter()],
});
