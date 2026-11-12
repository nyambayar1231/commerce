// Public surface of the `jobs` module (ARCHITECTURE.md §2): background jobs through a
// transactional outbox (ADR-0009) and outgoing email.

export { getJobQueue, JOB_SCHEMA, startJobQueue, stopJobQueue } from "./boss.ts";
export type { EmailConfig, EmailMessage, Mailer } from "./mailer.ts";
export { createSmtpMailer, readEmailConfig } from "./mailer.ts";
export type { JobQueue } from "./queues.ts";
export { defineQueue, enqueue, ensureQueue } from "./queues.ts";
export type { JobContext, JobHandler } from "./worker.ts";
export { defineJobHandler, startWorkers } from "./worker.ts";
