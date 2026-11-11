import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { createSession } from "../modules/identity/index.ts";
import { createContext, sessionTokenOf } from "./context.ts";

// The real (test) database. Covers how a request becomes `ctx.user` and the CORS policy.
const db = getDb();
const DASHBOARD = "http://localhost:5173";

let token: string;
let userId: string;

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user" CASCADE');
  const [u] = await db
    .insert(schema.user)
    .values({ email: "staff@example.com", isStaff: true })
    .returning({ id: schema.user.id });
  if (!u) throw new Error("no user");
  userId = u.id;
  ({ token } = await createSession(db, userId));
});

afterAll(async () => {
  await closeDb();
});

const request = (headers: Record<string, string>) =>
  new Request("http://test/graphql", { method: "POST", headers });

describe("sessionTokenOf", () => {
  it("reads a Bearer token, case-insensitively", () => {
    expect(sessionTokenOf(request({ authorization: "Bearer abc" }))).toBe("abc");
    expect(sessionTokenOf(request({ authorization: "bearer abc" }))).toBe("abc");
  });

  it("reads the session cookie among others", () => {
    expect(sessionTokenOf(request({ cookie: "theme=dark; session=abc; x=1" }))).toBe("abc");
    expect(sessionTokenOf(request({ cookie: "mysession=abc" }))).toBeNull();
  });

  it("prefers the Authorization header, even a malformed one, over the cookie", () => {
    expect(sessionTokenOf(request({ authorization: "Bearer a", cookie: "session=b" }))).toBe("a");
    expect(sessionTokenOf(request({ authorization: "Basic xyz", cookie: "session=b" }))).toBeNull();
  });

  it("is null without credentials", () => {
    expect(sessionTokenOf(request({}))).toBeNull();
  });
});

describe("createContext", () => {
  it("loads the user from a Bearer token", async () => {
    const ctx = await createContext(db, request({ authorization: `Bearer ${token}` }));
    expect(ctx.user?.id).toBe(userId);
    expect(ctx.sessionToken).toBe(token);
  });

  it("loads the user from the session cookie", async () => {
    const ctx = await createContext(db, request({ cookie: `session=${token}` }));
    expect(ctx.user?.id).toBe(userId);
  });

  it("is anonymous for no token or an unknown token", async () => {
    expect((await createContext(db, request({}))).user).toBeNull();
    const ctx = await createContext(db, request({ authorization: `Bearer ${"A".repeat(43)}` }));
    expect(ctx.user).toBeNull();
    expect(ctx.sessionToken).toBeNull();
  });

  it("creates the catalog, inventory and checkout loaders per request", async () => {
    const ctx = await createContext(db, request({}));
    expect(typeof ctx.loaders.categoryById.load).toBe("function");
    expect(typeof ctx.inventoryLoaders.stocksByVariantId.load).toBe("function");
    expect(typeof ctx.checkoutLoaders.linesByCheckoutId.load).toBe("function");
  });
});

describe("publicUrl", () => {
  const previous = process.env.PUBLIC_URL;

  afterEach(() => {
    if (previous === undefined) delete process.env.PUBLIC_URL;
    else process.env.PUBLIC_URL = previous;
  });

  it("is the request's origin when PUBLIC_URL is not set", async () => {
    delete process.env.PUBLIC_URL;
    const ctx = await createContext(db, new Request("http://api.example.com/graphql"));
    expect(ctx.publicUrl).toBe("http://api.example.com");
  });

  it("is PUBLIC_URL without trailing slashes when it is set", async () => {
    process.env.PUBLIC_URL = "https://api.example.com//";
    const ctx = await createContext(db, new Request("http://test/graphql"));
    expect(ctx.publicUrl).toBe("https://api.example.com");
  });
});

describe("CORS", () => {
  const app = createApp(db, { allowedOrigins: [DASHBOARD, "http://localhost:3000"] });
  const preflight = (origin: string) =>
    app.fetch("http://test/graphql", {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, x-graphql-yoga-csrf",
      },
    });

  it("allows the dashboard origin with credentials", async () => {
    const response = await preflight(DASHBOARD);
    expect(response.headers.get("access-control-allow-origin")).toBe(DASHBOARD);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("gives other origins no CORS headers", async () => {
    const response = await preflight("https://evil.example");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("gives other origins no CORS headers with a single allowed origin either", async () => {
    const single = createApp(db, { allowedOrigins: [DASHBOARD] });
    const response = await single.fetch("http://test/graphql", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
    });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses an empty or wildcard origin list", () => {
    expect(() => createApp(db, { allowedOrigins: [] })).toThrow();
    expect(() => createApp(db, { allowedOrigins: ["*"] })).toThrow();
  });
});
