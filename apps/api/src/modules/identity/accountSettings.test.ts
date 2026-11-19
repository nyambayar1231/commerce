import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestClient, expectPermissionDenied } from "../../../test/graphql.ts";
import {
  changePassword,
  createSession,
  hashRegistrationPassword,
  MAX_NAME_LENGTH,
  updateAccount,
} from "./index.ts";

// Account settings through the API (M15.2): Saleor's accountUpdate and passwordChange, through the
// real app and the real (test) database, plus the domain functions the resolvers call.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group CASCADE');
});

afterAll(async () => {
  await closeDb();
});

const ACCOUNT_UPDATE = `mutation($input: AccountInput!) {
  accountUpdate(input: $input) {
    user { id email firstName lastName }
    errors { field code message }
  }
}`;
const PASSWORD_CHANGE = `mutation($oldPassword: String, $newPassword: String!) {
  passwordChange(oldPassword: $oldPassword, newPassword: $newPassword) {
    user { id email }
    errors { field code message }
  }
}`;
const LOGIN = `mutation($email: String!, $password: String!) {
  tokenCreate(email: $email, password: $password) { user { email } errors { code } }
}`;
const ME = `query { me { email } }`;

const INVALID_OLD_PASSWORD = {
  user: null,
  errors: [
    {
      field: "oldPassword",
      code: "INVALID_CREDENTIALS",
      message: "Old password isn't valid.",
    },
  ],
};

/** A confirmed customer with a password and a session (as accounts.test.ts makes them). */
async function createCustomer(password: string | null = "old password") {
  const email = `${crypto.randomUUID()}@example.com`;
  const [user] = await db
    .insert(schema.user)
    .values({
      email,
      passwordHash: password === null ? null : await hashRegistrationPassword(password),
      isConfirmed: true,
    })
    .returning({ id: schema.user.id, email: schema.user.email });
  if (!user) throw new Error("no user");
  const { token } = await createSession(db, user.id);
  return { id: user.id, email: user.email, token };
}

const userRow = async (id: string) => {
  const [user] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  if (!user) throw new Error(`no user ${id}`);
  return user;
};

async function login(email: string, password: string) {
  const { response, body } = await client.gql(LOGIN, { email, password });
  const token = /^session=([^;]+);/.exec(response.headers.get("set-cookie") ?? "")?.[1] ?? null;
  return { token, payload: body.data?.tokenCreate };
}

describe("updateAccount", () => {
  it("trims the given name, keeps the other and clears a name with an empty string", async () => {
    const user = await createCustomer();
    const longAgo = new Date("2000-01-01T00:00:00Z");
    await db.update(schema.user).set({ updatedAt: longAgo }).where(eq(schema.user.id, user.id));

    const first = await updateAccount(db, user.id, { firstName: "  Bat  " });
    if (!first.ok) throw new Error("not ok");
    expect(first.user).toMatchObject({ firstName: "Bat", lastName: "" });

    const second = await updateAccount(db, user.id, { lastName: "Dorj" });
    if (!second.ok) throw new Error("not ok");
    expect(second.user).toMatchObject({ firstName: "Bat", lastName: "Dorj" });

    const third = await updateAccount(db, user.id, { firstName: "", lastName: null });
    if (!third.ok) throw new Error("not ok");
    expect(third.user).toMatchObject({ firstName: "", lastName: "Dorj" });
    const row = await userRow(user.id);
    expect(row).toMatchObject({ firstName: "", lastName: "Dorj" });
    expect(row.updatedAt.getTime()).toBeGreaterThan(longAgo.getTime());
  });
});

describe("accountUpdate", () => {
  it("changes only the name it is given", async () => {
    const user = await createCustomer();
    const first = await client.gql(ACCOUNT_UPDATE, { input: { firstName: "Bat" } }, user.token);
    expect(first.body.data?.accountUpdate).toEqual({
      user: { id: expect.any(String), email: user.email, firstName: "Bat", lastName: "" },
      errors: [],
    });

    const second = await client.gql(ACCOUNT_UPDATE, { input: { lastName: "Dorj" } }, user.token);
    expect(second.body.data?.accountUpdate).toMatchObject({
      user: { firstName: "Bat", lastName: "Dorj" },
      errors: [],
    });
  });

  it("refuses a name over 256 characters and changes nothing", async () => {
    const user = await createCustomer();
    await db
      .update(schema.user)
      .set({ firstName: "Bat", lastName: "Dorj" })
      .where(eq(schema.user.id, user.id));

    const { body } = await client.gql(
      ACCOUNT_UPDATE,
      { input: { firstName: "x".repeat(MAX_NAME_LENGTH + 1), lastName: "Other" } },
      user.token,
    );
    expect(body.data?.accountUpdate).toEqual({
      user: null,
      errors: [
        {
          field: "firstName",
          code: "INVALID",
          message: "Ensure this value has at most 256 characters.",
        },
      ],
    });
    expect(await userRow(user.id)).toMatchObject({ firstName: "Bat", lastName: "Dorj" });
  });

  it("requires a logged-in user", async () => {
    expectPermissionDenied(await client.gql(ACCOUNT_UPDATE, { input: { firstName: "Bat" } }), [
      "AUTHENTICATED_USER",
    ]);
  });
});

describe("changePassword", () => {
  it("keeps only the session it is given", async () => {
    const user = await createCustomer("old password");
    const other = await createSession(db, user.id);
    const longAgo = new Date("2000-01-01T00:00:00Z");
    await db.update(schema.user).set({ updatedAt: longAgo }).where(eq(schema.user.id, user.id));

    const result = await db.transaction((tx) =>
      changePassword(tx, user.id, user.token, {
        oldPassword: "old password",
        newPassword: "new password",
      }),
    );
    if (!result.ok) throw new Error("not ok");
    expect(result.user).toMatchObject({ id: user.id, email: user.email });
    expect((await userRow(user.id)).updatedAt.getTime()).toBeGreaterThan(longAgo.getTime());

    expect(
      await db.select().from(schema.session).where(eq(schema.session.userId, user.id)),
    ).toHaveLength(1);
    expect((await client.gql(ME, {}, user.token)).body.data).toEqual({
      me: { email: user.email },
    });
    expect((await client.gql(ME, {}, other.token)).body.data).toEqual({ me: null });
  });
});

describe("passwordChange", () => {
  it("sets the new password, keeps the current session and ends the others", async () => {
    const user = await createCustomer("old password");
    const other = await createSession(db, user.id);

    const { body } = await client.gql(
      PASSWORD_CHANGE,
      { oldPassword: "old password", newPassword: "new password" },
      user.token,
    );
    expect(body.data?.passwordChange).toEqual({
      user: { id: expect.any(String), email: user.email },
      errors: [],
    });

    // The old password is gone, the new one works.
    expect((await login(user.email, "old password")).payload).toEqual({
      user: null,
      errors: [{ code: "INVALID_CREDENTIALS" }],
    });
    expect((await login(user.email, "new password")).token).not.toBeNull();

    // The session that made the change still works; the other one was ended.
    expect((await client.gql(ME, {}, user.token)).body.data).toEqual({
      me: { email: user.email },
    });
    expect((await client.gql(ME, {}, other.token)).body.data).toEqual({ me: null });
  });

  it("refuses a wrong or missing old password and changes nothing", async () => {
    const user = await createCustomer("old password");
    const other = await createSession(db, user.id);
    const hashBefore = (await userRow(user.id)).passwordHash;

    expect(
      (
        await client.gql(
          PASSWORD_CHANGE,
          { oldPassword: "wrong password", newPassword: "new password" },
          user.token,
        )
      ).body.data?.passwordChange,
    ).toEqual(INVALID_OLD_PASSWORD);
    // Saleor's own rule: a missing password changes nothing either.
    expect(
      (await client.gql(PASSWORD_CHANGE, { newPassword: "new password" }, user.token)).body.data
        ?.passwordChange,
    ).toEqual(INVALID_OLD_PASSWORD);

    expect((await userRow(user.id)).passwordHash).toBe(hashBefore);
    // Both sessions still work: nothing was changed.
    expect((await client.gql(ME, {}, user.token)).body.data).toEqual({
      me: { email: user.email },
    });
    expect((await client.gql(ME, {}, other.token)).body.data).toEqual({
      me: { email: user.email },
    });
  });

  it("refuses a missing old password even when the account has none", async () => {
    const user = await createCustomer(null);
    expect(
      (await client.gql(PASSWORD_CHANGE, { newPassword: "new password" }, user.token)).body.data
        ?.passwordChange,
    ).toEqual(INVALID_OLD_PASSWORD);
    expect((await userRow(user.id)).passwordHash).toBeNull();
  });

  it("reports a short new password on newPassword and changes nothing", async () => {
    const user = await createCustomer("old password");
    const other = await createSession(db, user.id);
    const hashBefore = (await userRow(user.id)).passwordHash;

    expect(
      (
        await client.gql(
          PASSWORD_CHANGE,
          { oldPassword: "old password", newPassword: "short" },
          user.token,
        )
      ).body.data?.passwordChange,
    ).toEqual({
      user: null,
      errors: [
        {
          field: "newPassword",
          code: "PASSWORD_TOO_SHORT",
          message: "This password is too short. It must contain at least 8 characters.",
        },
      ],
    });

    expect((await userRow(user.id)).passwordHash).toBe(hashBefore);
    expect((await client.gql(ME, {}, other.token)).body.data).toEqual({
      me: { email: user.email },
    });
  });

  it("requires a logged-in user", async () => {
    expectPermissionDenied(await client.gql(PASSWORD_CHANGE, { newPassword: "new password" }), [
      "AUTHENTICATED_USER",
    ]);
  });
});
