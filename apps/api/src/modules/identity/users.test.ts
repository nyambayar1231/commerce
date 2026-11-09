import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CreateSuperuserError, createSuperuser } from "./index.ts";
import { verifyPassword } from "./password.ts";

// The real (test) database, like user.test.ts. Each test starts from an empty `user` table.
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user" CASCADE');
});

afterAll(async () => {
  await closeDb();
});

describe("createSuperuser", () => {
  it("creates an active staff superuser whose stored hash verifies and is not the plain text", async () => {
    const password = "correct horse battery staple";

    const created = await createSuperuser(db, {
      email: "admin@example.com",
      password,
      firstName: "Admin",
      lastName: "Bat",
    });

    expect(created.email).toBe("admin@example.com");

    const rows = await db
      .select({
        firstName: schema.user.firstName,
        lastName: schema.user.lastName,
        isStaff: schema.user.isStaff,
        isSuperuser: schema.user.isSuperuser,
        isActive: schema.user.isActive,
        passwordHash: schema.user.passwordHash,
      })
      .from(schema.user);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.isStaff).toBe(true);
    expect(row?.isSuperuser).toBe(true);
    expect(row?.isActive).toBe(true);
    expect(row?.firstName).toBe("Admin");
    expect(row?.lastName).toBe("Bat");
    expect(row?.passwordHash).not.toBe(password);
    await expect(verifyPassword(row?.passwordHash ?? "", password)).resolves.toBe(true);
  });

  it("trims whitespace around the email before storing it", async () => {
    const created = await createSuperuser(db, {
      email: "  admin@example.com  ",
      password: "password-123",
    });

    expect(created.email).toBe("admin@example.com");
  });

  it("rejects an email that is not a deliverable address", async () => {
    const invalid = createSuperuser(db, { email: "not-an-email", password: "password-123" });

    await expect(invalid).rejects.toMatchObject({ code: "INVALID_EMAIL" });
  });

  it("accepts passwords of exactly 8 and 128 characters", async () => {
    await expect(
      createSuperuser(db, { email: "a@example.com", password: "a".repeat(8) }),
    ).resolves.toMatchObject({ email: "a@example.com" });
    await expect(
      createSuperuser(db, { email: "b@example.com", password: "b".repeat(128) }),
    ).resolves.toMatchObject({ email: "b@example.com" });
  });

  it("rejects passwords shorter than 8 and longer than 128 characters", async () => {
    const tooShort = createSuperuser(db, { email: "a@example.com", password: "a".repeat(7) });
    await expect(tooShort).rejects.toMatchObject({ code: "PASSWORD_TOO_SHORT" });

    const tooLong = createSuperuser(db, { email: "b@example.com", password: "b".repeat(129) });
    await expect(tooLong).rejects.toMatchObject({ code: "PASSWORD_TOO_LONG" });
  });

  it("treats an email that differs only by case as taken, leaving the first user untouched", async () => {
    await createSuperuser(db, {
      email: "admin@example.com",
      password: "first-password-123",
    });
    const [before] = await db.select({ passwordHash: schema.user.passwordHash }).from(schema.user);

    const duplicate = createSuperuser(db, {
      email: "ADMIN@example.com",
      password: "second-password-456",
    });
    await expect(duplicate).rejects.toMatchObject({ code: "EMAIL_TAKEN" });

    const rows = await db.select({ passwordHash: schema.user.passwordHash }).from(schema.user);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.passwordHash).toBe(before?.passwordHash);
  });

  it("never includes the password in any error message", async () => {
    const invalidEmail = createSuperuser(db, {
      email: "not-an-email",
      password: "secret-for-invalid-email-1",
    });
    await expect(invalidEmail).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof CreateSuperuserError &&
        error.code === "INVALID_EMAIL" &&
        !error.message.includes("secret-for-invalid-email-1"),
    );

    const tooShortPassword = "s3cret!";
    const tooShort = createSuperuser(db, { email: "a@example.com", password: tooShortPassword });
    await expect(tooShort).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof CreateSuperuserError &&
        error.code === "PASSWORD_TOO_SHORT" &&
        !error.message.includes(tooShortPassword),
    );

    const tooLongPassword = "L".repeat(129);
    const tooLong = createSuperuser(db, { email: "b@example.com", password: tooLongPassword });
    await expect(tooLong).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof CreateSuperuserError &&
        error.code === "PASSWORD_TOO_LONG" &&
        !error.message.includes(tooLongPassword),
    );

    await createSuperuser(db, { email: "c@example.com", password: "first-password-123" });
    const taken = createSuperuser(db, {
      email: "C@example.com",
      password: "secret-for-taken-email-2",
    });
    await expect(taken).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof CreateSuperuserError &&
        error.code === "EMAIL_TAKEN" &&
        !error.message.includes("secret-for-taken-email-2"),
    );
  });
});
