import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// The real (test) database, like shop.test.ts. Each test starts from an empty `user` table.
const db = getDb();

const validUser = {
  email: "Admin@Example.com",
  passwordHash: null,
  firstName: "Admin",
  lastName: "Bat",
  isStaff: true,
  isSuperuser: true,
  isActive: true,
};

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user" CASCADE');
});

afterAll(async () => {
  await closeDb();
});

describe("user table", () => {
  it("generates a UUID v7 id", async () => {
    const [created] = await db
      .insert(schema.user)
      .values(validUser)
      .returning({ id: schema.user.id });

    // Version nibble 7, variant 10xx: the UUID v7 shape Postgres 18's uuidv7() produces.
    expect(created?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("rejects a second user whose email differs only by case (citext)", async () => {
    await db.insert(schema.user).values(validUser);

    const duplicate = db.insert(schema.user).values({ ...validUser, email: "admin@example.com" });

    // Drizzle wraps the driver error; the constraint name is on its `cause`.
    await expect(duplicate).rejects.toMatchObject({
      cause: { constraint_name: "user_email_unique" },
    });
  });

  it("rejects an empty email", async () => {
    const emptyEmail = db.insert(schema.user).values({ ...validUser, email: "" });

    await expect(emptyEmail).rejects.toMatchObject({
      cause: { constraint_name: "user_email_not_empty" },
    });
  });

  it("rejects a superuser that is not staff", async () => {
    const superuserNotStaff = db
      .insert(schema.user)
      .values({ ...validUser, isStaff: false, isSuperuser: true });

    await expect(superuserNotStaff).rejects.toMatchObject({
      cause: { constraint_name: "user_superuser_is_staff" },
    });
  });

  it("accepts a customer without a password hash (nullable)", async () => {
    const [created] = await db
      .insert(schema.user)
      .values({
        email: "customer@example.com",
        passwordHash: null,
        isStaff: false,
        isSuperuser: false,
      })
      .returning({ passwordHash: schema.user.passwordHash });

    expect(created?.passwordHash).toBeNull();
  });
});
