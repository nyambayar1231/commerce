import { closeDb, getDb, schema } from "@commerce/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient } from "../../../test/graphql.ts";
import {
  completeCheckout,
  createCheckout,
  createShippingMethod,
  initializeCheckoutTransaction,
  updateCheckoutAddress,
  updateCheckoutDeliveryMethod,
} from "../checkout/index.ts";
import { type EmailMessage, getJobQueue, stopJobQueue } from "../jobs/index.ts";
import { DUMMY_GATEWAY_ID } from "../payments/index.ts";
import {
  ACCOUNT_CONFIRM_SALT,
  makeToken,
  PASSWORD_RESET_SALT,
  passwordResetHandler,
  passwordResetQueue,
  readSecretKey,
} from "./index.ts";

// Password reset through the API (M15.1): requestPasswordReset queues one email (no account
// enumeration, 15-minute lock), the worker's handler sends the link, setPassword sets the new
// password, confirms the account, ends the user's sessions and logs them in.
const db = getDb();
const client = createTestClient(db);
const RESET_URL = "http://localhost:3000/reset-password";

const REQUEST = `mutation($email: String!, $redirectUrl: String!) {
  requestPasswordReset(email: $email, redirectUrl: $redirectUrl) { errors { field code message } }
}`;
const SET_PASSWORD = `mutation($email: String!, $token: String!, $password: String!) {
  setPassword(email: $email, token: $token, password: $password) {
    user { email isConfirmed }
    errors { field code message }
  }
}`;
const LOGIN = `mutation($email: String!, $password: String!) {
  tokenCreate(email: $email, password: $password) { user { email } errors { code } }
}`;
const ME = `query { me { email isConfirmed } }`;
const REGISTER = `mutation($input: AccountRegisterInput!) {
  accountRegister(input: $input) { errors { field code message } }
}`;
const CONFIRM = `mutation($email: String!, $token: String!) {
  confirmAccount(email: $email, token: $token) { user { email } errors { code } }
}`;

const INVALID_TOKEN = {
  user: null,
  errors: [{ field: "token", code: "INVALID", message: "Invalid or expired token." }],
};

beforeAll(async () => {
  // Creates the pgboss schema, so beforeEach can clear this queue's jobs even before the first
  // job of the run.
  await getJobQueue();
});

beforeEach(async () => {
  await db.$client.unsafe(
    'TRUNCATE "user", permission_group, "order", checkout, product, shipping_method, allocation, payment_transaction CASCADE',
  );
  // This file owns the queue, so it starts each test without jobs from earlier ones.
  await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${passwordResetQueue.name}`);
});

afterAll(async () => {
  await stopJobQueue();
  await closeDb();
});

const request = async (email: string, redirectUrl: string = RESET_URL) =>
  (await client.gql(REQUEST, { email, redirectUrl })).body.data?.requestPasswordReset as
    | { errors: { field: string; code: string; message: string }[] }
    | undefined;

const setPassword = async (email: string, token: string, password: string) => {
  const payload = (await client.gql(SET_PASSWORD, { email, token, password })).body.data
    ?.setPassword;
  if (!payload) throw new Error("no setPassword payload");
  return payload as {
    user: { email: string; isConfirmed: boolean } | null;
    errors: { field: string; code: string; message: string }[];
  };
};

/** The jobs queued for this queue, oldest first. */
async function resetJobs() {
  return db.execute<{ id: string; data: { userId: string; redirectUrl: string } }>(
    sql`SELECT id, data FROM pgboss.job WHERE name = ${passwordResetQueue.name} ORDER BY created_on`,
  );
}

/** Runs the worker's handler for a job and returns the email it sent. */
async function runHandler(data: { userId: string; redirectUrl: string }): Promise<EmailMessage> {
  const sent: EmailMessage[] = [];
  await passwordResetHandler.handle(data, {
    db,
    mailer: { send: async (message) => void sent.push(message) },
  });
  const [message] = sent;
  if (!message) throw new Error("no email");
  return message;
}

/** The email's link (`redirectUrl?email=…&token=…`). */
function resetLink(message: EmailMessage): URL {
  return new URL(/http:\/\/localhost:3000\/\S+/.exec(message.text)?.[0] ?? "");
}

/** Registers and confirms, as a customer does through the email. */
async function signUp(email: string, password: string) {
  await client.gql(REGISTER, { input: { email, password, redirectUrl: RESET_URL } });
  const [user] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  if (!user) throw new Error(`no user ${email}`);
  await client.gql(CONFIRM, {
    email,
    token: makeToken(user, ACCOUNT_CONFIRM_SALT, readSecretKey()),
  });
}

/** Logs in and returns the session token from the cookie (as accounts.test.ts). */
async function login(email: string, password: string) {
  const { response, body } = await client.gql(LOGIN, { email, password });
  const token = /^session=([^;]+);/.exec(response.headers.get("set-cookie") ?? "")?.[1] ?? null;
  return { token, payload: body.data?.tokenCreate };
}

/** Asks for a reset and returns the token from the email the worker would send. */
async function resetTokenFor(email: string): Promise<string> {
  expect(await request(email)).toEqual({ errors: [] });
  const [job] = await resetJobs();
  if (!job) throw new Error("no reset job");
  const message = await runHandler(job.data);
  expect(message.to).toBe(email);
  const token = resetLink(message).searchParams.get("token");
  if (!token) throw new Error("no token in the email");
  return token;
}

const userRow = async (email: string) => {
  const [user] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  if (!user) throw new Error(`no user ${email}`);
  return user;
};

describe("requestPasswordReset", () => {
  it("queues one email for a known account and answers the same for every email", async () => {
    await signUp("bat@example.com", "correct horse");
    // Trimmed and lower-cased on lookup.
    expect(await request(" Bat@Example.com ")).toEqual({ errors: [] });
    const jobs = await resetJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.data).toEqual({
      userId: (await userRow("bat@example.com")).id,
      redirectUrl: RESET_URL,
    });

    // Unknown and inactive accounts get the same answer and no email.
    expect(await request("nobody@example.com")).toEqual({ errors: [] });
    await db
      .update(schema.user)
      .set({ isActive: false })
      .where(eq(schema.user.email, "bat@example.com"));
    expect(await request("bat@example.com")).toEqual({ errors: [] });
    expect(await resetJobs()).toHaveLength(1);
  });

  it("sends at most one email per 15 minutes", async () => {
    await signUp("bat@example.com", "correct horse");
    expect(await request("bat@example.com")).toEqual({ errors: [] });
    expect(await request("bat@example.com")).toEqual({ errors: [] });
    expect(await resetJobs()).toHaveLength(1);

    // 16 minutes later the lock has passed (Saleor's RESET_PASSWORD_LOCK_TIME).
    await db.execute(
      sql`UPDATE "user" SET last_password_reset_request = now() - interval '16 minutes'`,
    );
    expect(await request("bat@example.com")).toEqual({ errors: [] });
    expect(await resetJobs()).toHaveLength(2);
  });

  it("refuses a redirect URL that is not on an allowed host, and sends nothing", async () => {
    await signUp("bat@example.com", "correct horse");
    expect(await request("bat@example.com", "https://evil.example/reset")).toEqual({
      errors: [
        {
          field: "redirectUrl",
          code: "INVALID",
          message:
            "evil.example is not allowed. Please check `ALLOWED_CLIENT_HOSTS` configuration.",
        },
      ],
    });
    expect(await request("bat@example.com", "javascript:alert(1)")).toEqual({
      errors: [
        {
          field: "redirectUrl",
          code: "INVALID",
          message: "Invalid URL. Please check if URL is in RFC 1808 format.",
        },
      ],
    });
    expect(await resetJobs()).toHaveLength(0);
    expect((await userRow("bat@example.com")).lastPasswordResetRequest).toBeNull();
  });

  it("queues an email for a staff account too", async () => {
    const staff = await createStaff(db, ["MANAGE_USERS"]);
    expect(await request(staff.email)).toEqual({ errors: [] });
    expect(await resetJobs()).toHaveLength(1);
  });
});

describe("passwordResetHandler", () => {
  it("emails a link built on the redirect URL with its own query kept", async () => {
    await signUp("bat@example.com", "correct horse");
    expect(await request("bat@example.com", `${RESET_URL}?source=email`)).toEqual({ errors: [] });
    const [job] = await resetJobs();
    if (!job) throw new Error("no job");

    const message = await runHandler(job.data);
    expect(message).toMatchObject({ to: "bat@example.com", subject: "Password reset e-mail" });
    const link = resetLink(message);
    expect(link.pathname).toBe("/reset-password");
    expect(link.searchParams.get("source")).toBe("email");
    expect(link.searchParams.get("email")).toBe("bat@example.com");
    expect(link.searchParams.get("token")).toMatch(/^[0-9a-z]{1,13}-[0-9a-f]{32}$/);
    // The text and the HTML both carry the link (escaped in the HTML).
    expect(message.text).toContain(link.toString());
    expect(message.html).toContain(link.toString().replace(/&/g, "&amp;"));

    // What the handler made is what setPassword accepts.
    expect(
      await setPassword("bat@example.com", link.searchParams.get("token") ?? "", "new password"),
    ).toMatchObject({ user: { email: "bat@example.com" }, errors: [] });
  });

  it("sends nothing for a deleted or deactivated user", async () => {
    await signUp("bat@example.com", "correct horse");
    expect(await request("bat@example.com")).toEqual({ errors: [] });
    const [job] = await resetJobs();
    if (!job) throw new Error("no job");
    const sent: EmailMessage[] = [];
    const context = {
      db,
      mailer: { send: async (message: EmailMessage) => void sent.push(message) },
    };

    await passwordResetHandler.handle({ ...job.data, userId: crypto.randomUUID() }, context);
    await db
      .update(schema.user)
      .set({ isActive: false })
      .where(eq(schema.user.id, job.data.userId));
    await passwordResetHandler.handle(job.data, context);
    expect(sent).toEqual([]);
  });
});

describe("setPassword", () => {
  it("sets the new password, logs the user in and ends their other sessions", async () => {
    await signUp("bat@example.com", "old password");
    const first = await login("bat@example.com", "old password");
    const second = await login("bat@example.com", "old password");
    expect(first.token).not.toBeNull();
    expect(second.token).not.toBeNull();

    const token = await resetTokenFor("bat@example.com");
    const { response, body } = await client.gql(SET_PASSWORD, {
      email: "bat@example.com",
      token,
      password: "new password",
    });
    expect(body.data?.setPassword).toEqual({
      user: { email: "bat@example.com", isConfirmed: true },
      errors: [],
    });

    // The response sets the session cookie; `me` with it returns the user. Only that session is left.
    const session = /^session=([^;]+);/.exec(response.headers.get("set-cookie") ?? "")?.[1];
    expect(session).toBeTruthy();
    expect((await client.gql(ME, {}, session ?? "")).body.data).toEqual({
      me: { email: "bat@example.com", isConfirmed: true },
    });
    const [user] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "bat@example.com"));
    expect(
      await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, user?.id ?? "")),
    ).toHaveLength(1);

    // The old password is gone, the new one works.
    expect((await login("bat@example.com", "old password")).payload).toEqual({
      user: null,
      errors: [{ code: "INVALID_CREDENTIALS" }],
    });
    expect((await login("bat@example.com", "new password")).token).not.toBeNull();

    // Both earlier sessions are refused.
    expect((await client.gql(ME, {}, first.token ?? "")).body.data).toEqual({ me: null });
    expect((await client.gql(ME, {}, second.token ?? "")).body.data).toEqual({ me: null });
  });

  it("refuses a used, wrong, foreign, expired or purpose-mismatched token the same way", async () => {
    await signUp("bat@example.com", "old password");
    await signUp("other@example.com", "other password");
    const token = await resetTokenFor("bat@example.com");
    expect((await setPassword("bat@example.com", token, "new password")).errors).toEqual([]);

    // The token hashed the old password hash and last login, so it works once.
    expect(await setPassword("bat@example.com", token, "another password")).toEqual(INVALID_TOKEN);
    expect(await setPassword("bat@example.com", "not-a-token", "another password")).toEqual(
      INVALID_TOKEN,
    );
    expect(await setPassword("nobody@example.com", token, "another password")).toEqual(
      INVALID_TOKEN,
    );

    const other = await userRow("other@example.com");
    // A token of another purpose. The password is short on purpose: the token is refused first.
    expect(
      await setPassword(
        "other@example.com",
        makeToken(other, ACCOUNT_CONFIRM_SALT, readSecretKey()),
        "x",
      ),
    ).toEqual(INVALID_TOKEN);
    // One made too long ago (TOKEN_TIMEOUT_SECONDS = 3 days).
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600 * 1000);
    expect(
      await setPassword(
        "other@example.com",
        makeToken(other, PASSWORD_RESET_SALT, readSecretKey(), fourDaysAgo),
        "another password",
      ),
    ).toEqual(INVALID_TOKEN);

    // An inactive account is refused just the same, even with a token made before.
    const beforeDeactivation = makeToken(other, PASSWORD_RESET_SALT, readSecretKey());
    await db
      .update(schema.user)
      .set({ isActive: false })
      .where(eq(schema.user.email, "other@example.com"));
    expect(await setPassword("other@example.com", beforeDeactivation, "long enough")).toEqual(
      INVALID_TOKEN,
    );
  });

  it("reports a short password without changing anything, and keeps the token usable", async () => {
    await signUp("bat@example.com", "old password");
    const token = await resetTokenFor("bat@example.com");
    const hashBefore = (await userRow("bat@example.com")).passwordHash;

    expect(await setPassword("bat@example.com", token, "short")).toEqual({
      user: null,
      errors: [
        {
          field: "password",
          code: "PASSWORD_TOO_SHORT",
          message: "This password is too short. It must contain at least 8 characters.",
        },
      ],
    });
    expect(await setPassword("bat@example.com", token, "x".repeat(129))).toEqual({
      user: null,
      errors: [
        {
          field: "password",
          code: "INVALID",
          message: "Ensure this value has at most 128 characters.",
        },
      ],
    });
    expect((await userRow("bat@example.com")).passwordHash).toBe(hashBefore);

    // Nothing changed, so the token still works.
    expect((await setPassword("bat@example.com", token, "new password")).errors).toEqual([]);
    expect((await login("bat@example.com", "new password")).token).not.toBeNull();
  });

  it("confirms an unconfirmed account and links its guest orders", async () => {
    await client.gql(REGISTER, {
      input: { email: "buyer@example.com", password: "old password", redirectUrl: RESET_URL },
    });
    const orderId = await placeGuestOrder("buyer@example.com");
    const token = await resetTokenFor("buyer@example.com");

    expect(await setPassword("buyer@example.com", token, "new password")).toEqual({
      user: { email: "buyer@example.com", isConfirmed: true },
      errors: [],
    });
    expect((await userRow("buyer@example.com")).isConfirmed).toBe(true);
    expect((await orderRow(orderId)).userId).toBe((await userRow("buyer@example.com")).id);
    // A confirmed account logs in with the password the reset set.
    expect((await login("buyer@example.com", "new password")).token).not.toBeNull();
  });
});

/** A paid guest order placed with `email`; returns its row id. */
async function placeGuestOrder(email: string): Promise<string> {
  const [product] = await db
    .insert(schema.product)
    .values({ name: "Boots", slug: "boots", isPublished: true })
    .returning();
  const [variant] = await db
    .insert(schema.productVariant)
    .values({
      productId: product?.id ?? "",
      name: "42",
      sku: "B-42",
      priceAmount: 1000,
      currency: "MNT",
      trackInventory: false,
    })
    .returning();
  const method = await createShippingMethod(db, { name: "Standard", price: "500" });
  if (!method.ok) throw new Error("no shipping method");

  const created = await createCheckout(db, {
    lines: [{ variantId: variant?.id ?? "", quantity: 1 }],
    email,
  });
  if (!created.ok) throw new Error("no checkout");
  const id = created.checkout.id;
  const address = {
    firstName: "Bat",
    lastName: "Dorj",
    streetAddress1: "A 1",
    city: "UB",
    country: "MN",
  };
  await updateCheckoutAddress(db, id, "SHIPPING", address);
  await updateCheckoutAddress(db, id, "BILLING", address);
  await updateCheckoutDeliveryMethod(db, id, method.shippingMethod.id);
  await initializeCheckoutTransaction(db, id, { gatewayId: DUMMY_GATEWAY_ID });
  const result = await completeCheckout(db, id);
  if (!result.ok) throw new Error("not placed");
  return result.order.id;
}

async function orderRow(id: string) {
  const [row] = await db.select().from(schema.order).where(eq(schema.order.id, id));
  if (!row) throw new Error("no order");
  return row;
}
