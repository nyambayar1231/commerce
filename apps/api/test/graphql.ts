import { type Db, schema } from "@commerce/db";
import { expect } from "vitest";
import { createApp } from "../src/app.ts";
import { createSession, type Permission } from "../src/modules/identity/index.ts";

// Shared helpers for GraphQL contract tests: requests go through the real app (Yoga, context,
// CORS, error masking) against the real test database.
//
// The pattern for a guarded field or mutation (ARCHITECTURE.md §8):
//
//   const staff = await createStaff(db, ["MANAGE_STAFF"]);
//   const other = await createStaff(db, ["MANAGE_ORDERS"]);
//   expectPermissionDenied(await client.gql(DOC, vars), ["MANAGE_STAFF"]);               // anonymous
//   expectPermissionDenied(await client.gql(DOC, vars, other.token), ["MANAGE_STAFF"]);  // lacks it
//   expect((await client.gql(DOC, vars, staff.token)).body.errors).toBeUndefined();     // has it

export type GqlResult = { response: Response; body: GqlBody };
type GqlBody = {
  data?: Record<string, unknown> | null;
  errors?: { message: string; path?: (string | number)[]; extensions?: Record<string, unknown> }[];
};

export function createTestClient(db: Db) {
  const app = createApp(db, { allowedOrigins: ["http://localhost:5173"] });

  /** POST a GraphQL document, authenticated with `token` as a Bearer token when given. */
  async function gql(query: string, variables: object = {}, token?: string): Promise<GqlResult> {
    const response = await app.fetch("http://test/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    return { response, body: (await response.json()) as GqlBody };
  }

  return { gql };
}

/**
 * An active staff user in a fresh permission group holding `permissions` (no group when empty),
 * with a session. `superuser` makes a superuser instead (every permission, no group).
 */
export async function createStaff(
  db: Db,
  permissions: Permission[] = [],
  { superuser = false, email = `${crypto.randomUUID()}@example.com` } = {},
) {
  const [user] = await db
    .insert(schema.user)
    .values({ email, isStaff: true, isSuperuser: superuser })
    .returning({ id: schema.user.id });
  if (!user) throw new Error("no user");

  if (permissions.length > 0) {
    const [group] = await db
      .insert(schema.permissionGroup)
      .values({ name: `group-${crypto.randomUUID()}` })
      .returning({ id: schema.permissionGroup.id });
    if (!group) throw new Error("no group");
    await db
      .insert(schema.permissionGroupPermission)
      .values(permissions.map((code) => ({ groupId: group.id, code })));
    await db.insert(schema.userPermissionGroup).values({ userId: user.id, groupId: group.id });
  }

  const { token } = await createSession(db, user.id);
  return { id: user.id, email, token };
}

/** The request was refused by `requirePermission` with Saleor's error, naming `permissions`. */
export function expectPermissionDenied({ body }: GqlResult, permissions: Permission[]) {
  expect(body.errors).toEqual([
    expect.objectContaining({
      message: `To access this path, you need one of the following permissions: ${permissions.join(", ")}`,
      extensions: { exception: { code: "PermissionDenied" } },
    }),
  ]);
}
