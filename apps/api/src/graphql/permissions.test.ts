import { closeDb, getDb } from "@commerce/db";
import { locatedError } from "graphql";
import { maskError } from "graphql-yoga";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff } from "../../test/graphql.ts";
import { createSession } from "../modules/identity/index.ts";
import { createContext } from "./context.ts";
import { permissionDenied, requirePermission } from "./permissions.ts";

// The real (test) database: contexts are built from real sessions, as for a request.
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group CASCADE');
});

afterAll(async () => {
  await closeDb();
});

const contextFor = (token?: string) =>
  createContext(
    db,
    new Request("http://test/graphql", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  );

const DENIED = "To access this path, you need one of the following permissions: MANAGE_STAFF";

describe("requirePermission", () => {
  it("denies an anonymous request", async () => {
    await expect(requirePermission(await contextFor(), "MANAGE_STAFF")).rejects.toThrow(DENIED);
  });

  it("denies staff without the permission", async () => {
    const { token } = await createStaff(db, ["MANAGE_ORDERS"]);
    await expect(requirePermission(await contextFor(token), "MANAGE_STAFF")).rejects.toThrow(
      DENIED,
    );
  });

  it("allows staff whose group grants it", async () => {
    const { token } = await createStaff(db, ["MANAGE_STAFF"]);
    await expect(requirePermission(await contextFor(token), "MANAGE_STAFF")).resolves.toBe(
      undefined,
    );
  });

  it("needs any one of several permissions, and names them all when denying", async () => {
    const { token } = await createStaff(db, ["MANAGE_ORDERS"]);
    const ctx = await contextFor(token);
    await expect(requirePermission(ctx, "MANAGE_STAFF", "MANAGE_ORDERS")).resolves.toBe(undefined);
    await expect(requirePermission(ctx, "MANAGE_STAFF", "MANAGE_PRODUCTS")).rejects.toThrow(
      "To access this path, you need one of the following permissions: MANAGE_STAFF, MANAGE_PRODUCTS",
    );
  });

  it("allows a superuser without groups", async () => {
    const { token } = await createStaff(db, [], { superuser: true });
    await expect(requirePermission(await contextFor(token), "MANAGE_SHIPPING")).resolves.toBe(
      undefined,
    );
  });

  it("denies a non-staff user even if a group grants the permission", async () => {
    const { id } = await createStaff(db, ["MANAGE_STAFF"]);
    await db.$client.unsafe('UPDATE "user" SET is_staff = false WHERE id = $1', [id]);
    const { token } = await createSession(db, id);
    await expect(requirePermission(await contextFor(token), "MANAGE_STAFF")).rejects.toThrow(
      DENIED,
    );
  });

  it("loads the permissions once per request", async () => {
    const { token } = await createStaff(db, ["MANAGE_STAFF"]);
    const ctx = await contextFor(token);
    expect(ctx.permissions()).toBe(ctx.permissions());
  });
});

describe("permissionDenied", () => {
  it("carries Saleor's exception code and survives Yoga's error masking", () => {
    // What graphql-js makes of an error thrown in a resolver, then what Yoga sends.
    const thrown = locatedError(permissionDenied(["MANAGE_STAFF"]), [], ["staffCreate"]);
    const sent = maskError(thrown, "Unexpected error.", false);

    expect(sent.message).toBe(DENIED);
    expect((sent as typeof thrown).extensions).toEqual({
      exception: { code: "PermissionDenied" },
    });
  });
});
