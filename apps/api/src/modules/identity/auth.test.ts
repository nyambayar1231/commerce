import { closeDb, getDb, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clientAt } from "../../../test/graphql.ts";
import { createApp } from "../../app.ts";
import { clientIpOf } from "../../clientIp.ts";
import { tryBlock } from "../rateLimit/index.ts";
import { createSuperuser } from "./index.ts";
import { delaySeconds } from "./login.ts";

// GraphQL contract for tokenCreate / logout / me, through the real app and the real (test) DB.
const db = getDb();
const app = createApp(db, { allowedOrigins: ["http://localhost:5173"] });
const EMAIL = "admin@example.com";
const PASSWORD = "correct horse battery staple";

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", rate_limit CASCADE');
  await createSuperuser(db, { email: EMAIL, password: PASSWORD, firstName: "Ada" });
});

afterAll(async () => {
  await closeDb();
});

async function gql(
  query: string,
  variables: object = {},
  headers: Record<string, string> = {},
  ip?: string,
) {
  const response = await app.fetch(
    "http://test/graphql",
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ query, variables }),
    },
    clientAt(ip),
  );
  const text = await response.text();
  return { response, text, body: JSON.parse(text) };
}

const LOGIN = `mutation ($email: String!, $password: String!) {
  tokenCreate(email: $email, password: $password) {
    user { id email firstName isStaff }
    errors { field code message }
  }
}`;
const ME = "{ me { email } }";
const LOGOUT = "mutation { logout { errors { code } } }";

const login = (email = EMAIL, password = PASSWORD) => gql(LOGIN, { email, password });

// The session token from a login response's Set-Cookie header.
function tokenOf(response: Response): string {
  const match = /^session=([^;]+);/.exec(response.headers.get("set-cookie") ?? "");
  if (!match?.[1]) throw new Error("no session cookie");
  return match[1];
}

const INVALID = {
  data: {
    tokenCreate: {
      user: null,
      errors: [
        { field: "email", code: "INVALID_CREDENTIALS", message: "Please, enter valid credentials" },
      ],
    },
  },
};

describe("tokenCreate", () => {
  it("logs in: returns the user and sets an HttpOnly, Secure, SameSite=Lax cookie, not a token", async () => {
    const { response, text, body } = await login("ADMIN@example.com"); // emails are case-insensitive

    expect(body.data.tokenCreate.errors).toEqual([]);
    expect(body.data.tokenCreate.user).toMatchObject({
      email: EMAIL,
      firstName: "Ada",
      isStaff: true,
    });
    const userId = Buffer.from(body.data.tokenCreate.user.id, "base64").toString();
    expect(userId).toMatch(/^User:[0-9a-f-]{36}$/);

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(text).not.toContain(tokenOf(response));
  });

  it("gives the same error for a wrong password, an unknown email and a user without a password", async () => {
    await db.insert(schema.user).values({ email: "nopass@example.com", isStaff: true });

    expect((await login(EMAIL, "wrong password")).body).toEqual(INVALID);
    expect((await login("nobody@example.com")).body).toEqual(INVALID);
    expect((await login("nopass@example.com")).body).toEqual(INVALID);
    expect((await login(EMAIL, "x".repeat(129))).body).toEqual(INVALID);
  });

  it("sets no cookie when login fails", async () => {
    const { response } = await login(EMAIL, "wrong password");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("reports INACTIVE only with the right password", async () => {
    await db.update(schema.user).set({ isActive: false }).where(eq(schema.user.email, EMAIL));

    expect((await login(EMAIL, "wrong password")).body).toEqual(INVALID);
    const { body } = await login();
    expect(body.data.tokenCreate.errors).toEqual([
      { field: "email", code: "INACTIVE", message: "Account inactive." },
    ]);
  });

  it("replaces the session the request came with", async () => {
    const first = tokenOf((await login()).response);
    const second = await gql(
      LOGIN,
      { email: EMAIL, password: PASSWORD },
      { cookie: `session=${first}` },
    );
    tokenOf(second.response);

    expect((await gql(ME, {}, { cookie: `session=${first}` })).body.data.me).toBeNull();
  });
});

describe("me", () => {
  it("returns the user for the session cookie or a Bearer token", async () => {
    const token = tokenOf((await login()).response);
    expect((await gql(ME, {}, { cookie: `session=${token}` })).body.data.me).toEqual({
      email: EMAIL,
    });
    expect((await gql(ME, {}, { authorization: `Bearer ${token}` })).body.data.me).toEqual({
      email: EMAIL,
    });
  });

  it("is null when anonymous", async () => {
    expect((await gql(ME)).body).toEqual({ data: { me: null } });
  });

  it("is null once the session has expired", async () => {
    const token = tokenOf((await login()).response);
    await db.update(schema.session).set({ expiresAt: sql`now() - interval '1 second'` });
    expect((await gql(ME, {}, { cookie: `session=${token}` })).body.data.me).toBeNull();
  });
});

describe("logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const token = tokenOf((await login()).response);

    const { response, body } = await gql(LOGOUT, {}, { cookie: `session=${token}` });
    expect(body).toEqual({ data: { logout: { errors: [] } } });
    expect(response.headers.get("set-cookie")).toMatch(/^session=; .*Max-Age=0/);

    expect((await gql(ME, {}, { authorization: `Bearer ${token}` })).body.data.me).toBeNull();
    expect(await db.select().from(schema.session)).toHaveLength(0);
  });

  it("succeeds without a session", async () => {
    expect((await gql(LOGOUT)).body).toEqual({ data: { logout: { errors: [] } } });
  });
});

// Saleor's login throttling (PLAN M9.3, ../saleor-core/saleor/account/throttling.py).
describe("login throttling", () => {
  const IP = "203.0.113.7";
  const loginFrom = (ip: string, password = PASSWORD, email = EMAIL) =>
    gql(LOGIN, { email, password }, {}, ip);
  const codesOf = (body: { data: { tokenCreate: { errors: { code: string }[] } } }) =>
    body.data.tokenCreate.errors.map((e) => e.code);
  // Ends the IP's current block, as waiting for it would.
  const liftBlock = () =>
    db.execute(sql`update rate_limit set expires_at = now() - interval '1 second'
      where key like 'login:block:%'`);
  const blockSeconds = async (ip: string) => {
    const [row] = await db.execute<{ seconds: number }>(sql`select
      round(extract(epoch from expires_at - now()))::int as seconds
      from rate_limit where key = ${`login:block:ip:${ip}`} and expires_at > now()`);
    return row?.seconds ?? 0;
  };

  it("computes Saleor's delays", () => {
    expect(delaySeconds(0, 0)).toBe(1);
    // Per IP, any emails: doubles every 10 failures, 1 h from the 100th.
    expect([1, 10, 11, 20, 21, 99, 100].map((n) => delaySeconds(n, 0))).toEqual([
      1, 1, 2, 2, 4, 512, 3600,
    ]);
    // Per IP and account: doubles every failure, 1 h from the 10th.
    expect([1, 2, 3, 9, 10].map((n) => delaySeconds(0, n))).toEqual([1, 2, 4, 256, 3600]);
    expect(delaySeconds(21, 2)).toBe(4);
  });

  it("refuses a login without a known client IP", async () => {
    const response = await app.fetch("http://test/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: LOGIN, variables: { email: EMAIL, password: PASSWORD } }),
    });
    const body = await response.json();
    expect(body.data.tokenCreate).toEqual({
      user: null,
      errors: [
        {
          field: null,
          code: "UNKNOWN_IP_ADDRESS",
          message: "Can't identify requester IP address.",
        },
      ],
    });
  });

  it("delays the next attempt from the IP after a failure, not other IPs", async () => {
    expect(codesOf((await loginFrom(IP, "wrong")).body)).toEqual(["INVALID_CREDENTIALS"]);

    const delayed = (await loginFrom(IP)).body.data.tokenCreate;
    expect(delayed.user).toBeNull();
    expect(delayed.errors).toEqual([
      {
        field: null,
        code: "LOGIN_ATTEMPT_DELAYED",
        message: expect.stringMatching(
          /^Logging has been suspended till \d{4}-\d\d-\d\dT[\d:.]+Z due to too many logging attempts originating from the same IP address\.$/,
        ),
      },
    ]);
    expect(codesOf((await loginFrom("203.0.113.8")).body)).toEqual([]);
  });

  it("doubles the block with each failure for an account, and a success clears it", async () => {
    for (const expected of [1, 2, 4]) {
      await liftBlock();
      expect(codesOf((await loginFrom(IP, "wrong")).body)).toEqual(["INVALID_CREDENTIALS"]);
      expect(await blockSeconds(IP)).toBe(expected);
    }
    await liftBlock();
    expect(codesOf((await loginFrom(IP)).body)).toEqual([]);
    const keys = await db.execute<{ key: string }>(sql`select key from rate_limit`);
    expect(keys.map((row) => row.key)).toEqual([]);
  });

  it("counts unknown emails per IP only", async () => {
    for (let i = 0; i < 3; i++) {
      await liftBlock();
      await loginFrom(IP, "wrong", `nobody${i}@example.com`);
    }
    const rows = await db.execute<{ key: string; count: number }>(
      sql`select key, count from rate_limit where key like 'login:fail:%'`,
    );
    expect(rows.map((row) => ({ ...row }))).toEqual([{ key: `login:fail:ip:${IP}`, count: 3 }]);
    expect(await blockSeconds(IP)).toBe(1);
  });

  // Two real simultaneous logins don't always overlap (the first can finish, and a success clears
  // the block, before the second starts), so the in-flight attempt is its block, claimed as
  // authenticate() claims it; tryBlock's atomicity is tested in rateLimit.test.ts.
  it("delays an attempt while another attempt from the IP is in flight", async () => {
    expect(await tryBlock(db, `login:block:ip:${IP}`, 1)).toBeNull();
    expect(codesOf((await loginFrom(IP)).body)).toEqual(["LOGIN_ATTEMPT_DELAYED"]);
  });
});

describe("clientIpOf", () => {
  const request = (forwarded?: string) =>
    new Request("http://test/graphql", {
      headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded },
    });
  const socket = clientAt("192.0.2.1").req;

  it("uses the socket address unless the proxy is trusted", () => {
    expect(clientIpOf(request("198.51.100.1"), socket, false)).toBe("192.0.2.1");
    expect(clientIpOf(request(), undefined, false)).toBeNull();
  });

  it("behind a trusted proxy uses the last X-Forwarded-For entry, never a forged first one", () => {
    expect(clientIpOf(request("6.6.6.6, 198.51.100.1"), socket, true)).toBe("198.51.100.1");
    expect(clientIpOf(request("2001:db8::1"), socket, true)).toBe("2001:db8::1");
    expect(clientIpOf(request("not-an-ip"), socket, true)).toBe("192.0.2.1");
    expect(clientIpOf(request(), socket, true)).toBe("192.0.2.1");
  });
});
