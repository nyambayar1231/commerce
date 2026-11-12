import { PgBoss } from "pg-boss";

// The process's pg-boss instance (ADR-0009). pg-boss owns the `pgboss` schema: `start()` creates
// and upgrades it (PLAN M8 decision 8), so it isn't a drizzle migration. The API process only
// adds jobs: it starts pg-boss without supervision or scheduling (no maintenance timers); the
// worker starts its own instance with them (src/worker.ts).

export const JOB_SCHEMA = "pgboss";

let started: Promise<PgBoss> | undefined;

/** pg-boss for `DATABASE_URL`, started once (lazily, on the first job). */
export function getJobQueue(): Promise<PgBoss> {
  if (!started) {
    started = startJobQueue({ supervise: false }).catch((error: unknown) => {
      started = undefined;
      throw error;
    });
  }
  return started;
}

/** A started pg-boss instance; `supervise` runs pg-boss's maintenance (the worker does). */
export async function startJobQueue({ supervise }: { supervise: boolean }): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
  const boss = new PgBoss({
    connectionString,
    schema: JOB_SCHEMA,
    // A small pool of its own: the API's queries keep theirs (packages/db).
    max: supervise ? 5 : 2,
    supervise,
    schedule: false,
    application_name: supervise ? "commerce-worker" : "commerce-api-jobs",
  });
  boss.on("error", (error) => console.error("[jobs]", error));
  await boss.start();
  return boss;
}

/** Stops the lazily started instance (server shutdown, tests). */
export async function stopJobQueue(): Promise<void> {
  const current = started;
  started = undefined;
  if (current) await (await current).stop({ graceful: false });
}
