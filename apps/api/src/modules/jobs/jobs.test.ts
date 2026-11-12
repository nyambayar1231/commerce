import { closeDb, getDb } from "@commerce/db";
import { sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  defineJobHandler,
  defineQueue,
  type EmailMessage,
  enqueue,
  getJobQueue,
  type Mailer,
  readEmailConfig,
  startJobQueue,
  startWorkers,
  stopJobQueue,
} from "./index.ts";

// The outbox guarantees (ADR-0009, PLAN M8.1): a job exists exactly when the transaction that
// added it commits, and the worker runs committed jobs and retries failed ones. Each test uses its own queue, so runs never see each other's jobs.
const db = getDb();
let worker: PgBoss;

beforeAll(async () => {
  worker = await startJobQueue({ supervise: false });
});

afterAll(async () => {
  await worker.stop({ graceful: false });
  await stopJobQueue();
  await closeDb();
});

const testQueue = (options = {}) =>
  defineQueue<{ value: string }>(`test-${crypto.randomUUID()}`, options);

const jobsIn = async (name: string) =>
  (
    await db.execute<{ data: { value: string } }>(
      sql`SELECT data FROM pgboss.job WHERE name = ${name} ORDER BY created_on`,
    )
  ).map((row) => row.data.value);

/** Waits until `check` passes (the worker polls), failing after `timeoutMs`. */
async function eventually(check: () => boolean | Promise<boolean>, timeoutMs = 10_000) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const fakeMailer = (): Mailer & { sent: EmailMessage[] } => {
  const sent: EmailMessage[] = [];
  return { sent, send: async (message) => void sent.push(message) };
};

describe("enqueue", () => {
  it("adds the job only when the transaction commits", async () => {
    const queue = testQueue();

    await expect(
      db.transaction(async (tx) => {
        await enqueue(tx, queue, { value: "rolled back" });
        throw new Error("the business change failed");
      }),
    ).rejects.toThrow("the business change failed");
    expect(await jobsIn(queue.name)).toEqual([]);

    await db.transaction(async (tx) => {
      await enqueue(tx, queue, { value: "committed" });
    });
    expect(await jobsIn(queue.name)).toEqual(["committed"]);
  });
});

describe("workers", () => {
  it("run committed jobs with the worker's mailer", async () => {
    const queue = testQueue();
    const mailer = fakeMailer();
    await startWorkers(
      worker,
      [
        defineJobHandler(queue, async (data, context) => {
          await context.mailer.send({
            to: "a@example.com",
            subject: data.value,
            text: "",
            html: "",
          });
        }),
      ],
      { db, mailer },
      { pollingIntervalSeconds: 0.5 },
    );

    await db.transaction((tx) => enqueue(tx, queue, { value: "hello" }));
    await eventually(() => mailer.sent.length === 1);
    expect(mailer.sent[0]?.subject).toBe("hello");
    await worker.offWork(queue.name);
  });

  it("retry a job whose handler throws", async () => {
    const queue = testQueue({ retryLimit: 2, retryDelay: 1, retryBackoff: false });
    let calls = 0;
    await startWorkers(
      worker,
      [
        defineJobHandler(queue, async () => {
          calls += 1;
          if (calls === 1) throw new Error("SMTP server unavailable");
        }),
      ],
      { db, mailer: fakeMailer() },
      { pollingIntervalSeconds: 0.5 },
    );

    await db.transaction((tx) => enqueue(tx, queue, { value: "retry me" }));
    await eventually(async () => {
      const rows = await db.execute<{ state: string }>(
        sql`SELECT state FROM pgboss.job WHERE name = ${queue.name}`,
      );
      return rows[0]?.state === "completed";
    }, 15_000);
    expect(calls).toBe(2);
    await worker.offWork(queue.name);
  });
});

describe("readEmailConfig", () => {
  it("names a missing or wrong variable", () => {
    expect(
      readEmailConfig({ EMAIL_URL: "smtp://localhost:1026", DEFAULT_FROM_EMAIL: "a@b.c" }),
    ).toEqual({ url: "smtp://localhost:1026", from: "a@b.c" });
    expect(() => readEmailConfig({ DEFAULT_FROM_EMAIL: "a@b.c" })).toThrow("EMAIL_URL is not set");
    expect(() => readEmailConfig({ EMAIL_URL: "http://x", DEFAULT_FROM_EMAIL: "a@b.c" })).toThrow(
      "smtp://",
    );
    expect(() => readEmailConfig({ EMAIL_URL: "smtp://x" })).toThrow("DEFAULT_FROM_EMAIL");
  });
});

// The API's own lazily started instance is the one enqueue uses.
it("starts the API's pg-boss once", async () => {
  expect(await getJobQueue()).toBe(await getJobQueue());
});
