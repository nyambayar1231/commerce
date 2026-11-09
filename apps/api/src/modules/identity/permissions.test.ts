import { closeDb, getDb, schema } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getEffectivePermissions, PERMISSIONS, type Permission } from "./index.ts";

// The real (test) database.
const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group CASCADE');
});

afterAll(async () => {
  await closeDb();
});

async function createUser(values: Partial<typeof schema.user.$inferInsert> = {}) {
  const [u] = await db
    .insert(schema.user)
    .values({ email: `${crypto.randomUUID()}@example.com`, isStaff: true, ...values })
    .returning({ id: schema.user.id });
  if (!u) throw new Error("no user");
  return u.id;
}

async function createGroup(name: string, codes: Permission[], members: string[] = []) {
  const [g] = await db
    .insert(schema.permissionGroup)
    .values({ name })
    .returning({ id: schema.permissionGroup.id });
  if (!g) throw new Error("no group");
  if (codes.length > 0) {
    await db
      .insert(schema.permissionGroupPermission)
      .values(codes.map((code) => ({ groupId: g.id, code })));
  }
  if (members.length > 0) {
    await db
      .insert(schema.userPermissionGroup)
      .values(members.map((userId) => ({ userId, groupId: g.id })));
  }
  return g.id;
}

describe("getEffectivePermissions", () => {
  it("is empty for a staff user without groups", async () => {
    const userId = await createUser();
    expect(await getEffectivePermissions(db, userId)).toEqual([]);
  });

  it("is the union over the user's groups, without duplicates, in enum order", async () => {
    const userId = await createUser();
    await createGroup("Orders", ["MANAGE_SHIPPING", "MANAGE_ORDERS"], [userId]);
    await createGroup("Catalog", ["MANAGE_ORDERS", "MANAGE_PRODUCTS"], [userId]);
    await createGroup("Staff", ["MANAGE_STAFF"]); // not a member

    expect(await getEffectivePermissions(db, userId)).toEqual([
      "MANAGE_PRODUCTS",
      "MANAGE_ORDERS",
      "MANAGE_SHIPPING",
    ]);
  });

  it("gives a superuser every permission, with or without groups", async () => {
    const userId = await createUser({ isSuperuser: true });
    expect(await getEffectivePermissions(db, userId)).toEqual([...PERMISSIONS]);
  });

  it("gives an inactive user nothing, even a superuser or a group member", async () => {
    const member = await createUser({ isActive: false });
    await createGroup("Catalog", ["MANAGE_PRODUCTS"], [member]);
    const superuser = await createUser({ isSuperuser: true, isActive: false });

    expect(await getEffectivePermissions(db, member)).toEqual([]);
    expect(await getEffectivePermissions(db, superuser)).toEqual([]);
  });

  it("is empty for an unknown user", async () => {
    expect(await getEffectivePermissions(db, crypto.randomUUID())).toEqual([]);
  });

  it("drops a group's permissions when the group is deleted", async () => {
    const userId = await createUser();
    await createGroup("Catalog", ["MANAGE_PRODUCTS"], [userId]);
    await db.delete(schema.permissionGroup);
    expect(await getEffectivePermissions(db, userId)).toEqual([]);
    expect(await db.select().from(schema.userPermissionGroup)).toEqual([]);
  });
});

describe("permission tables", () => {
  it("reject a code outside the enum", async () => {
    const groupId = await createGroup("Catalog", []);
    await expect(
      db.$client.unsafe(
        "INSERT INTO permission_group_permission (group_id, code) VALUES ($1, 'MANAGE_APPS')",
        [groupId],
      ),
    ).rejects.toThrow(/invalid input value for enum permission/);
  });

  it("reject a duplicate or empty group name", async () => {
    await createGroup("Catalog", []);
    await expect(createGroup("Catalog", [])).rejects.toThrow();
    await expect(createGroup("", [])).rejects.toThrow();
  });
});
