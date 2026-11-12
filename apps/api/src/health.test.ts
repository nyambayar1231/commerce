import { closeDb, createDb, getDb } from "@commerce/db";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

// The health endpoints (PLAN M9.2) through the real Yoga app: liveness never touches the
// database; readiness answers 503 when the database can't be reached.

const options = { allowedOrigins: ["http://localhost:5173"] };
// Nothing listens on port 1: every query fails at once with ECONNREFUSED.
const deadDb = createDb("postgres://commerce:commerce@127.0.0.1:1/commerce");

afterAll(async () => {
  await deadDb.$client.end({ timeout: 1 });
  await closeDb();
});

describe("health endpoints", () => {
  it("answers liveness without the database", async () => {
    const response = await createApp(deadDb, options).fetch("http://localhost/health/live");
    expect(response.status).toBe(200);
  });

  it("is ready when the database answers", async () => {
    const response = await createApp(getDb(), options).fetch("http://localhost/health/ready");
    expect(response.status).toBe(200);
  });

  it("is not ready when the database is down, without saying why", async () => {
    const response = await createApp(deadDb, options).fetch("http://localhost/health/ready");
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
});
