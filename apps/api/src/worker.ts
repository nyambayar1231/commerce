import { closeDb, getDb } from "@commerce/db";
import {
  createSmtpMailer,
  type JobHandler,
  readEmailConfig,
  startJobQueue,
  startWorkers,
} from "./modules/jobs/index.ts";

// The background worker (ADR-0009, PLAN M8): `pnpm --filter @commerce/api worker`. It runs the
// jobs the API adds to pg-boss inside its transactions, sending email through `EMAIL_URL`. It is
// a separate process from the API so a slow SMTP server never holds up a request; several
// workers may run at once (pg-boss claims each job once with SKIP LOCKED).

// Every job type the worker runs; each feature adds its handler here (M8.2, M8.3).
const HANDLERS: JobHandler[] = [];

const mailer = createSmtpMailer(readEmailConfig());
const boss = await startJobQueue({ supervise: true });
await startWorkers(boss, HANDLERS, { db: getDb(), mailer });
console.log(`Worker running (${HANDLERS.length} job types)`);

// Finish the running jobs, then close the pools so the process can exit.
async function shutdown() {
  await boss.stop({ graceful: true, timeout: 10_000 });
  await closeDb();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
