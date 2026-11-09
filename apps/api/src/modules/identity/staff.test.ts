import { closeDb, getDb, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createStaff,
  createTestClient,
  expectPermissionDenied,
  type GqlResult,
} from "../../../test/graphql.ts";
import { toGlobalId } from "../../graphql/globalId.ts";
import { createSession, type Permission } from "./index.ts";

// GraphQL contract for permissionGroupCreate / permissionGroupUpdate / staffCreate, through the
// real app and the real (test) DB.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group CASCADE');
});

afterAll(async () => {
  await closeDb();
});

const GROUP_CREATE = `mutation ($input: PermissionGroupCreateInput!) {
  permissionGroupCreate(input: $input) {
    group { id name permissions { code } users { email } }
    errors { field code message permissions users }
  }
}`;
const GROUP_UPDATE = `mutation ($id: ID!, $input: PermissionGroupUpdateInput!) {
  permissionGroupUpdate(id: $id, input: $input) {
    group { id name permissions { code } users { email } }
    errors { field code message permissions users }
  }
}`;
const STAFF_CREATE = `mutation ($input: StaffCreateInput!) {
  staffCreate(input: $input) {
    user { email firstName isStaff userPermissions { code } }
    errors { field code message groups }
  }
}`;

const userId = (id: string) => toGlobalId("User", id);
const groupId = (id: string) => toGlobalId("Group", id);
const data = (result: GqlResult, field: string) =>
  (result.body.data as Record<string, { errors: unknown[]; [key: string]: unknown }>)[field];

/** A group created straight in the database, with optional members. */
async function insertGroup(name: string, codes: Permission[], members: string[] = []) {
  const [group] = await db
    .insert(schema.permissionGroup)
    .values({ name })
    .returning({ id: schema.permissionGroup.id });
  if (!group) throw new Error("no group");
  if (codes.length > 0) {
    await db
      .insert(schema.permissionGroupPermission)
      .values(codes.map((code) => ({ groupId: group.id, code })));
  }
  for (const member of members) {
    await db.insert(schema.userPermissionGroup).values({ userId: member, groupId: group.id });
  }
  return group.id;
}

// The guard contract: every staff-management mutation refuses anonymous requests, customers and
// staff without MANAGE_STAFF, and lets MANAGE_STAFF through.
describe.each([
  { name: "permissionGroupCreate", doc: GROUP_CREATE, vars: () => ({ input: { name: "G" } }) },
  {
    name: "permissionGroupUpdate",
    doc: GROUP_UPDATE,
    vars: async () => ({ id: groupId(await insertGroup("G", [])), input: { name: "H" } }),
  },
  { name: "staffCreate", doc: STAFF_CREATE, vars: () => ({ input: { email: "new@example.com" } }) },
])("$name requires MANAGE_STAFF", ({ name, doc, vars }) => {
  it("denies anonymous requests", async () => {
    expectPermissionDenied(await client.gql(doc, await vars()), ["MANAGE_STAFF"]);
  });

  it("denies staff without MANAGE_STAFF", async () => {
    const { token } = await createStaff(db, ["MANAGE_ORDERS", "MANAGE_PRODUCTS"]);
    expectPermissionDenied(await client.gql(doc, await vars(), token), ["MANAGE_STAFF"]);
  });

  it("denies a customer", async () => {
    const [customer] = await db
      .insert(schema.user)
      .values({ email: "customer@example.com" })
      .returning({ id: schema.user.id });
    if (!customer) throw new Error("no customer");
    const { token } = await createSession(db, customer.id);
    expectPermissionDenied(await client.gql(doc, await vars(), token), ["MANAGE_STAFF"]);
  });

  it("allows staff with MANAGE_STAFF", async () => {
    const { token } = await createStaff(db, ["MANAGE_STAFF"]);
    const result = await client.gql(doc, await vars(), token);
    expect(result.body.errors).toBeUndefined();
    expect(data(result, name)?.errors).toEqual([]);
  });
});

describe("permissionGroupCreate", () => {
  it("creates a group with permissions and staff members", async () => {
    const admin = await createStaff(db, [], { superuser: true });
    const member = await createStaff(db, [], { email: "member@example.com" });
    const result = await client.gql(
      GROUP_CREATE,
      {
        input: {
          name: " Catalog ",
          addPermissions: ["MANAGE_PRODUCTS", "MANAGE_ORDERS", "MANAGE_PRODUCTS"],
          addUsers: [userId(member.id)],
        },
      },
      admin.token,
    );

    expect(data(result, "permissionGroupCreate")).toMatchObject({
      errors: [],
      group: {
        name: "Catalog",
        permissions: [{ code: "MANAGE_PRODUCTS" }, { code: "MANAGE_ORDERS" }],
        users: [{ email: "member@example.com" }],
      },
    });
    const me = await client.gql("{ me { userPermissions { code } } }", {}, member.token);
    expect(me.body.data).toEqual({
      me: { userPermissions: [{ code: "MANAGE_PRODUCTS" }, { code: "MANAGE_ORDERS" }] },
    });
  });

  it("refuses permissions the requestor lacks, users who aren't staff, and taken or blank names", async () => {
    const requestor = await createStaff(db, ["MANAGE_STAFF"]);
    const [customer] = await db
      .insert(schema.user)
      .values({ email: "customer@example.com" })
      .returning({ id: schema.user.id });
    if (!customer) throw new Error("no customer");
    await insertGroup("Taken", []);

    const taken = await client.gql(
      GROUP_CREATE,
      {
        input: {
          name: "Taken",
          addPermissions: ["MANAGE_STAFF", "MANAGE_ORDERS"],
          addUsers: [userId(customer.id)],
        },
      },
      requestor.token,
    );
    expect(data(taken, "permissionGroupCreate")).toEqual({
      group: null,
      errors: [
        {
          field: "name",
          code: "UNIQUE",
          message: "Group with this Name already exists.",
          permissions: null,
          users: null,
        },
        {
          field: "addPermissions",
          code: "OUT_OF_SCOPE_PERMISSION",
          message: "You can't add permission that you don't have.",
          permissions: ["MANAGE_ORDERS"],
          users: null,
        },
        {
          field: "addUsers",
          code: "ASSIGN_NON_STAFF_MEMBER",
          message: "User must be staff member.",
          permissions: null,
          users: [userId(customer.id)],
        },
      ],
    });

    const blank = await client.gql(GROUP_CREATE, { input: { name: "  " } }, requestor.token);
    expect(data(blank, "permissionGroupCreate")?.errors).toMatchObject([
      { field: "name", code: "REQUIRED" },
    ]);
    // Nothing was written: only the requestor's group and "Taken" exist.
    expect(await db.select().from(schema.permissionGroup)).toHaveLength(2);
  });

  it("answers unknown or malformed user IDs with Saleor's top-level errors", async () => {
    const { token } = await createStaff(db, [], { superuser: true });
    const unknown = userId(crypto.randomUUID());
    const notFound = await client.gql(
      GROUP_CREATE,
      { input: { name: "G", addUsers: [unknown] } },
      token,
    );
    expect(notFound.body.errors?.[0]?.message).toBe(
      `Could not resolve to a node with the global id list of '["${unknown}"]'.`,
    );

    const wrongType = groupId(crypto.randomUUID());
    const invalid = await client.gql(
      GROUP_CREATE,
      { input: { name: "G", addUsers: [wrongType] } },
      token,
    );
    expect(invalid.body.errors?.[0]?.message).toBe(
      `Invalid ID: ${wrongType}. Expected: User, received: Group.`,
    );

    const garbage = await client.gql(
      GROUP_CREATE,
      { input: { name: "G", addUsers: ["nope"] } },
      token,
    );
    expect(garbage.body.errors?.[0]?.message).toBe("Couldn't resolve id: nope.");
    expect(await db.select().from(schema.permissionGroup)).toEqual([]);
  });
});

describe("permissionGroupUpdate", () => {
  it("renames, adds and removes permissions and members", async () => {
    const admin = await createStaff(db, [], { superuser: true });
    const stays = await createStaff(db, [], { email: "stays@example.com" });
    const leaves = await createStaff(db, [], { email: "leaves@example.com" });
    const joins = await createStaff(db, [], { email: "joins@example.com" });
    const id = await insertGroup(
      "Catalog",
      ["MANAGE_PRODUCTS", "MANAGE_ORDERS"],
      [stays.id, leaves.id],
    );

    const result = await client.gql(
      GROUP_UPDATE,
      {
        id: groupId(id),
        input: {
          name: "Catalog team",
          addPermissions: ["MANAGE_SHIPPING", "MANAGE_PRODUCTS"],
          removePermissions: ["MANAGE_ORDERS"],
          addUsers: [userId(joins.id)],
          removeUsers: [userId(leaves.id)],
        },
      },
      admin.token,
    );

    expect(data(result, "permissionGroupUpdate")).toEqual({
      errors: [],
      group: {
        id: groupId(id),
        name: "Catalog team",
        permissions: [{ code: "MANAGE_PRODUCTS" }, { code: "MANAGE_SHIPPING" }],
        users: [{ email: "joins@example.com" }, { email: "stays@example.com" }],
      },
    });
  });

  it("refuses a group with permissions beyond the requestor's", async () => {
    const requestor = await createStaff(db, ["MANAGE_STAFF"]);
    const id = await insertGroup("Orders", ["MANAGE_ORDERS"]);
    const result = await client.gql(
      GROUP_UPDATE,
      { id: groupId(id), input: { name: "Mine now" } },
      requestor.token,
    );
    expect(data(result, "permissionGroupUpdate")).toMatchObject({
      group: null,
      errors: [
        {
          field: null,
          code: "OUT_OF_SCOPE_PERMISSION",
          message: "You can't manage group with permissions out of your scope.",
        },
      ],
    });
    const [group] = await db
      .select()
      .from(schema.permissionGroup)
      .where(eq(schema.permissionGroup.id, id));
    expect(group?.name).toBe("Orders");
  });

  it("refuses removing a permission or a user beyond the requestor's scope", async () => {
    const requestor = await createStaff(db, ["MANAGE_STAFF"]);
    const boss = await createStaff(db, [], { superuser: true });
    const id = await insertGroup("Staff", ["MANAGE_STAFF"], [boss.id]);

    const result = await client.gql(
      GROUP_UPDATE,
      {
        id: groupId(id),
        input: { removePermissions: ["MANAGE_ORDERS"], removeUsers: [userId(boss.id)] },
      },
      requestor.token,
    );
    expect(data(result, "permissionGroupUpdate")?.errors).toMatchObject([
      {
        field: "removePermissions",
        code: "OUT_OF_SCOPE_PERMISSION",
        permissions: ["MANAGE_ORDERS"],
      },
      { field: "removeUsers", code: "OUT_OF_SCOPE_USER", users: [userId(boss.id)] },
    ]);
  });

  it("refuses removing yourself from your last group, and an item both added and removed", async () => {
    const requestor = await createStaff(db, ["MANAGE_STAFF"]);
    const [membership] = await db
      .select()
      .from(schema.userPermissionGroup)
      .where(eq(schema.userPermissionGroup.userId, requestor.id));
    if (!membership) throw new Error("no membership");

    const result = await client.gql(
      GROUP_UPDATE,
      {
        id: groupId(membership.groupId),
        input: {
          addPermissions: ["MANAGE_STAFF"],
          removePermissions: ["MANAGE_STAFF"],
          removeUsers: [userId(requestor.id)],
        },
      },
      requestor.token,
    );
    expect(data(result, "permissionGroupUpdate")?.errors).toMatchObject([
      { field: "permissions", code: "DUPLICATED_INPUT_ITEM", permissions: ["MANAGE_STAFF"] },
      {
        field: "removeUsers",
        code: "CANNOT_REMOVE_FROM_LAST_GROUP",
        message: "You cannot remove yourself from your last group.",
        users: [userId(requestor.id)],
      },
    ]);
  });
});

describe("staffCreate", () => {
  it("creates an active staff user without a password, in the given groups", async () => {
    const requestor = await createStaff(db, ["MANAGE_STAFF", "MANAGE_PRODUCTS"]);
    const catalog = await insertGroup("Catalog", ["MANAGE_PRODUCTS"]);

    const result = await client.gql(
      STAFF_CREATE,
      { input: { email: " New@Example.com ", firstName: "Ada", addGroups: [groupId(catalog)] } },
      requestor.token,
    );

    expect(data(result, "staffCreate")).toEqual({
      errors: [],
      user: {
        email: "new@example.com",
        firstName: "Ada",
        isStaff: true,
        userPermissions: [{ code: "MANAGE_PRODUCTS" }],
      },
    });
    const [row] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "new@example.com"));
    expect(row).toMatchObject({
      isStaff: true,
      isSuperuser: false,
      isActive: true,
      passwordHash: null,
    });
  });

  it("refuses a blank, invalid or taken email and groups beyond the requestor's scope", async () => {
    const requestor = await createStaff(db, ["MANAGE_STAFF"], { email: "me@example.com" });
    const orders = await insertGroup("Orders", ["MANAGE_ORDERS"]);
    const staffCreate = async (input: object) =>
      data(await client.gql(STAFF_CREATE, { input }, requestor.token), "staffCreate");

    expect(await staffCreate({})).toMatchObject({
      user: null,
      errors: [{ field: "email", code: "REQUIRED" }],
    });
    expect(await staffCreate({ email: "not-an-email" })).toMatchObject({
      errors: [{ field: "email", code: "INVALID", message: "Enter a valid email address." }],
    });
    expect(
      await staffCreate({ email: "ME@example.com", addGroups: [groupId(orders)] }),
    ).toMatchObject({
      errors: [
        { field: "email", code: "UNIQUE", message: "User with this Email already exists." },
        {
          field: "addGroups",
          code: "OUT_OF_SCOPE_GROUP",
          message: "You can't manage these groups.",
          groups: [groupId(orders)],
        },
      ],
    });
    expect(await db.select().from(schema.user)).toHaveLength(1);
  });
});
