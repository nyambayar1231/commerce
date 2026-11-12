import type { Db } from "@commerce/db";
import type { PgBoss } from "pg-boss";
import { logger } from "../../logger.ts";
import type { Mailer } from "./mailer.ts";
import { ensureQueue, type JobQueue } from "./queues.ts";

// The worker side of the outbox: each queue gets a handler that receives the job's data and the
// worker's dependencies. A handler that throws leaves the job to pg-boss's retry (with backoff);
// after the last try the job is `failed` and stays in pgboss.job for inspection.

export interface JobContext {
  db: Db;
  mailer: Mailer;
}

export interface JobHandler<TData extends object = object> {
  queue: JobQueue<TData>;
  // Method syntax on purpose: a handler for one job type fits a list of handlers for any type.
  handle(data: TData, context: JobContext): Promise<void>;
}

/** Binds a handler to its queue with the data type checked. */
export const defineJobHandler = <TData extends object>(
  queue: JobQueue<TData>,
  handle: (data: TData, context: JobContext) => Promise<void>,
): JobHandler<TData> => ({ queue, handle });

/** Creates the queues and starts one pg-boss worker per handler; returns the worker ids. */
export async function startWorkers(
  boss: PgBoss,
  handlers: readonly JobHandler[],
  context: JobContext,
  options: { pollingIntervalSeconds?: number } = {},
): Promise<string[]> {
  const ids: string[] = [];
  for (const handler of handlers) {
    await ensureQueue(boss, handler.queue);
    ids.push(
      await boss.work<object>(
        handler.queue.name,
        { pollingIntervalSeconds: options.pollingIntervalSeconds ?? 2 },
        async ([job]) => {
          if (!job) return;
          // One line per outcome (PLAN M9.2); the data is left out, it holds email addresses.
          const attrs = { queue: handler.queue.name, jobId: job.id };
          try {
            await handler.handle(job.data, context);
          } catch (error) {
            logger.error({ ...attrs, err: error }, "Job failed (pg-boss retries it)");
            throw error;
          }
          logger.info(attrs, "Job done");
        },
      ),
    );
  }
  return ids;
}
