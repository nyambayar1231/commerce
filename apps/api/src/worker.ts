import { closeDb, getDb } from "@commerce/db";
import { assertConfig } from "./config.ts";
import { logger } from "./logger.ts";
import {
  createPaidCheckoutHandler,
  readStaffNotificationEmails,
} from "./modules/checkout/index.ts";
import { accountConfirmationHandler, passwordResetHandler } from "./modules/identity/index.ts";
import {
  createSmtpMailer,
  type JobHandler,
  readEmailConfig,
  startJobQueue,
  startWorkers,
} from "./modules/jobs/index.ts";
import { orderConfirmationHandler } from "./modules/orders/index.ts";
import {
  createReconcileHandler,
  gatewayRegistryFromEnv,
  RECONCILE_CRON,
  reconcilePaymentsQueue,
} from "./modules/payments/index.ts";

// The background worker (ADR-0009, PLAN M8): `pnpm --filter @commerce/api worker`. It runs the
// jobs the API adds to pg-boss inside its transactions, sending email through `EMAIL_URL`. It is
// a separate process from the API so a slow SMTP server never holds up a request; several
// workers may run at once (pg-boss claims each job once with SKIP LOCKED).

// Fail at start with every configuration problem listed (PLAN M9.1).
assertConfig("worker");

// The payment gateways (PAYMENT_GATEWAYS, ADR-0016): the worker completes paid checkouts, refunds
// and reconciles with the same ones the API starts payments with.
const gateways = gatewayRegistryFromEnv();

// Every job type the worker runs; each feature adds its handler here (M8.2, M8.3, M16.2).
const HANDLERS: JobHandler[] = [
  orderConfirmationHandler,
  accountConfirmationHandler,
  passwordResetHandler,
  createPaidCheckoutHandler(gateways, readStaffNotificationEmails()),
  createReconcileHandler(gateways),
];
const mailer = createSmtpMailer(readEmailConfig());
const boss = await startJobQueue({ supervise: true });
await startWorkers(boss, HANDLERS, { db: getDb(), mailer });
// Every 2 minutes, finish what lost webhooks or outages left (ADR-0016 §6). An upsert: restarts
// and several workers keep one schedule.
await boss.schedule(reconcilePaymentsQueue.name, RECONCILE_CRON);
logger.info({ jobTypes: HANDLERS.length }, "Worker running");

// Finish the running jobs, then close the pools so the process can exit.
async function shutdown() {
  await boss.stop({ graceful: true, timeout: 10_000 });
  await closeDb();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
