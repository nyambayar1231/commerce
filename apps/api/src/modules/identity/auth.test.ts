import { closeDb, getDb, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.ts";
import { createSuperuser } from "./index.ts";

// GraphQL contract for tokenCreate / logout / me, through the real app and the real (test) DB.
const db = getDb();
const app = createApp(db, { allowedOrigins: ["http://localhost:5173"] });
const EMAIL = "admin@example.com";
const PASSWORD = "correct horse battery staple";

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user" CASCADE');
  await createSuperuser(db, { email: EMAIL, password: PASSWORD, firstName: "Ada" });
});

afterAll(async () => {
  await closeDb();
});

async function gql(query: string, variables: object = {}, headers: Record<string, string> = {}) {
  const response = await app.fetch("http://test/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ query, variables }),
  });
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
