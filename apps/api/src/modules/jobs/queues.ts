import type { Tx } from "@commerce/db";
import { sql } from "drizzle-orm";
import { fromDrizzle, type PgBoss, type QueueOptions } from "pg-boss";
import { getJobQueue } from "./boss.ts";

// Background jobs as a transactional outbox (ADR-0009, PLAN M8): a job is inserted into pg-boss's
// job table through the caller's transaction, so it exists exactly when the business change
// commits — a rolled-back order sends no email, a committed one can't lose its email. The worker
// process (src/worker.ts) runs the jobs with pg-boss's retries. A job exists once because the
// change that adds it happens once (e.g. checkout completion is idempotent). Delivery is at least
// once: a worker that dies after sending but before pg-boss records the job as done sends again.

/** A queue: its name, its retry and expiry options, and (as a type) its job data. */
export interface JobQueue<TData extends object> {
  readonly name: string;
  readonly options: QueueOptions;
  /** Type-only: the shape of the job data. */
  readonly data?: TData;
}

/**
 * Defines a queue. Our defaults: 5 tries with exponential backoff starting at 30 s (Saleor's
 * email tasks retry too), 5 minutes to run a job, completed jobs kept 7 days.
 */
export function defineQueue<TData extends object>(
  name: string,
  options: QueueOptions = {},
): JobQueue<TData> {
  return {
    name,
    options: {
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 300,
      deleteAfterSeconds: 7 * 24 * 3600,
      ...options,
    },
  };
}

// Queues already created in this process (createQueue is an upsert, but one round trip is enough).
const ensured = new Map<string, Promise<void>>();

/** Creates the queue in pg-boss once per process. */
export function ensureQueue(boss: PgBoss, queue: JobQueue<object>): Promise<void> {
  let ready = ensured.get(queue.name);
  if (!ready) {
    ready = boss.createQueue(queue.name, queue.options).catch((error: unknown) => {
      ensured.delete(queue.name);
      throw error;
    });
    ensured.set(queue.name, ready);
  }
  return ready;
}

/** Adds a job inside `tx`: it commits or rolls back with the caller's change. Returns its id. */
export async function enqueue<TData extends object>(
  tx: Tx,
  queue: JobQueue<TData>,
  data: TData,
): Promise<string> {
  const boss = await getJobQueue();
  await ensureQueue(boss, queue);
  const id = await boss.send(queue.name, data, { db: fromDrizzle(tx, sql) });
  // A standard queue always creates the job; null would mean a policy we don't use.
  if (id === null) throw new Error(`queue ${queue.name} refused the job`);
  return id;
}
