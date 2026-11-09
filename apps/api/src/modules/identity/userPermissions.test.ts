import { closeDb, getDb } from "@commerce/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStaff, createTestClient } from "../../../test/graphql.ts";

// GraphQL contract for `me { userPermissions }`, through the real app and the real (test) DB.
const db = getDb();
const client = createTestClient(db);

beforeEach(async () => {
  await db.$client.unsafe('TRUNCATE "user", permission_group CASCADE');
});

afterAll(async () => {
  await closeDb();
});

const ME = "{ me { userPermissions { code name } } }";

describe("me.userPermissions", () => {
  it("lists the permissions of the user's groups, with Saleor's names", async () => {
    const { token } = await createStaff(db, ["MANAGE_ORDERS", "MANAGE_PRODUCTS"]);
    const { body } = await client.gql(ME, {}, token);

    expect(body).toEqual({
      data: {
        me: {
          userPermissions: [
            { code: "MANAGE_PRODUCTS", name: "Manage products." },
            { code: "MANAGE_ORDERS", name: "Manage orders." },
          ],
        },
      },
    });
  });

  it("is empty for staff without groups", async () => {
    const { token } = await createStaff(db);
    const { body } = await client.gql(ME, {}, token);
    expect(body).toEqual({ data: { me: { userPermissions: [] } } });
  });

  it("is every permission for a superuser", async () => {
    const { token } = await createStaff(db, [], { superuser: true });
    const { body } = await client.gql("{ me { userPermissions { code } } }", {}, token);
    expect(body.data?.me).toEqual({
      userPermissions: [
        { code: "MANAGE_PRODUCTS" },
        { code: "MANAGE_ORDERS" },
        { code: "MANAGE_CHECKOUTS" },
        { code: "MANAGE_USERS" },
        { code: "MANAGE_STAFF" },
        { code: "MANAGE_SETTINGS" },
        { code: "MANAGE_SHIPPING" },
      ],
    });
  });
});
