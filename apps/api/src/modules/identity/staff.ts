import { type Executor, schema } from "@commerce/db";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { getEffectivePermissions, type Permission } from "./permissions.ts";
import { EMAIL_PATTERN } from "./users.ts";

// Staff management: permission groups and staff accounts, as Saleor's permissionGroupCreate /
// permissionGroupUpdate / staffCreate (saleor/graphql/account/mutations/{permission_group,staff}).
// The caller has already passed `requirePermission(ctx, "MANAGE_STAFF")`; the checks here are
// Saleor's guards against privilege escalation: a non-superuser can't grant, remove or manage
// anything beyond their own permissions. Left out: channels, webhooks, the set-password email
// (M8), and Saleor's LEFT_NOT_MANAGEABLE_PERMISSION check.

/** Who is making the change. */
export type Requestor = { id: string; isSuperuser: boolean; permissions: readonly Permission[] };

export type StaffErrorCode =
  | "REQUIRED"
  | "UNIQUE"
  | "INVALID"
  | "ASSIGN_NON_STAFF_MEMBER"
  | "DUPLICATED_INPUT_ITEM"
  | "CANNOT_REMOVE_FROM_LAST_GROUP"
  | "OUT_OF_SCOPE_PERMISSION"
  | "OUT_OF_SCOPE_USER"
  | "OUT_OF_SCOPE_GROUP";

/** A validation error; `users` and `groups` hold row ids (the GraphQL layer makes global IDs). */
export type StaffError = {
  field: string | null;
  message: string;
  code: StaffErrorCode;
  permissions?: Permission[];
  users?: string[];
  groups?: string[];
};

export type StaffResult = { ok: true; id: string } | { ok: false; errors: StaffError[] };

/** Ids in the input that match no row (Saleor answers with a top-level error). */
export class NotFoundError extends Error {
  readonly kind: "User" | "Group";
  readonly ids: string[];

  constructor(kind: "User" | "Group", ids: string[]) {
    super(`${kind} not found: ${ids.join(", ")}`);
    this.name = "NotFoundError";
    this.kind = kind;
    this.ids = ids;
  }
}

export type PermissionGroupCreateInput = {
  name: string;
  addPermissions?: Permission[];
  addUsers?: string[];
};

export type PermissionGroupUpdateInput = {
  name?: string | null;
  addPermissions?: Permission[];
  removePermissions?: Permission[];
  addUsers?: string[];
  removeUsers?: string[];
};

export type StaffCreateInput = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive?: boolean | null;
  addGroups?: string[];
};

const MESSAGES = {
  blank: "This field cannot be blank.",
  groupNameTaken: "Group with this Name already exists.",
  permissionOutOfScope: "You can't add permission that you don't have.",
  groupOutOfScope: "You can't manage group with permissions out of your scope.",
  nonStaff: "User must be staff member.",
  usersOutOfScope: "You can't manage these users.",
  lastGroup: "You cannot remove yourself from your last group.",
  duplicated: "The same object cannot be in both list for adding and removing items.",
  invalidEmail: "Enter a valid email address.",
  emailTaken: "User with this Email already exists.",
  groupsOutOfScope: "You can't manage these groups.",
} as const;

const distinct = <T>(items: readonly T[] = []) => [...new Set(items)];

/** The permissions in `wanted` the requestor doesn't hold (none for a superuser). */
const outOfScope = (requestor: Requestor, wanted: readonly Permission[]) =>
  requestor.isSuperuser ? [] : wanted.filter((code) => !requestor.permissions.includes(code));

async function loadUsers(db: Executor, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: schema.user.id, isStaff: schema.user.isStaff })
    .from(schema.user)
    .where(inArray(schema.user.id, ids));
  const missing = ids.filter((id) => !rows.some((row) => row.id === id));
  if (missing.length > 0) throw new NotFoundError("User", missing);
  return rows;
}

async function loadGroups(db: Executor, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: schema.permissionGroup.id })
    .from(schema.permissionGroup)
    .where(inArray(schema.permissionGroup.id, ids));
  const missing = ids.filter((id) => !rows.some((row) => row.id === id));
  if (missing.length > 0) throw new NotFoundError("Group", missing);

  const codes = await db
    .select()
    .from(schema.permissionGroupPermission)
    .where(inArray(schema.permissionGroupPermission.groupId, ids));
  return rows.map((row) => ({
    id: row.id,
    permissions: codes.filter((c) => c.groupId === row.id).map((c) => c.code),
  }));
}

async function groupNameTaken(db: Executor, name: string, exceptId?: string) {
  const [row] = await db
    .select({ id: schema.permissionGroup.id })
    .from(schema.permissionGroup)
    .where(
      exceptId
        ? and(eq(schema.permissionGroup.name, name), ne(schema.permissionGroup.id, exceptId))
        : eq(schema.permissionGroup.name, name),
    );
  return row !== undefined;
}

function checkName(name: string): StaffError | null {
  return name === "" ? { field: "name", code: "REQUIRED", message: MESSAGES.blank } : null;
}

function checkPermissionsInScope(
  requestor: Requestor,
  codes: Permission[],
  field: string,
): StaffError[] {
  const missing = outOfScope(requestor, codes);
  return missing.length > 0
    ? [
        {
          field,
          code: "OUT_OF_SCOPE_PERMISSION",
          message: MESSAGES.permissionOutOfScope,
          permissions: missing,
        },
      ]
    : [];
}

function checkStaff(users: { id: string; isStaff: boolean }[], field: string): StaffError[] {
  const nonStaff = users.filter((u) => !u.isStaff).map((u) => u.id);
  return nonStaff.length > 0
    ? [{ field, code: "ASSIGN_NON_STAFF_MEMBER", message: MESSAGES.nonStaff, users: nonStaff }]
    : [];
}

function checkDuplicates<T extends string>(
  add: T[],
  remove: T[],
  field: "permissions" | "users",
): StaffError[] {
  const both = add.filter((item) => remove.includes(item));
  if (both.length === 0) return [];
  return [
    {
      field,
      code: "DUPLICATED_INPUT_ITEM",
      message: MESSAGES.duplicated,
      ...(field === "permissions" ? { permissions: both as Permission[] } : { users: both }),
    },
  ];
}

async function addMembers(
  db: Executor,
  groupId: string,
  permissions: Permission[],
  users: string[],
) {
  if (permissions.length > 0) {
    await db
      .insert(schema.permissionGroupPermission)
      .values(permissions.map((code) => ({ groupId, code })))
      .onConflictDoNothing();
  }
  if (users.length > 0) {
    await db
      .insert(schema.userPermissionGroup)
      .values(users.map((userId) => ({ userId, groupId })))
      .onConflictDoNothing();
  }
}

export async function createPermissionGroup(
  db: Executor,
  requestor: Requestor,
  input: PermissionGroupCreateInput,
): Promise<StaffResult> {
  const name = input.name.trim();
  const addPermissions = distinct(input.addPermissions);
  const addUsers = distinct(input.addUsers);

  return db.transaction(async (tx) => {
    const errors: StaffError[] = [];
    const nameError = checkName(name);
    if (nameError) errors.push(nameError);
    else if (await groupNameTaken(tx, name)) {
      errors.push({ field: "name", code: "UNIQUE", message: MESSAGES.groupNameTaken });
    }
    errors.push(...checkPermissionsInScope(requestor, addPermissions, "addPermissions"));
    errors.push(...checkStaff(await loadUsers(tx, addUsers), "addUsers"));
    if (errors.length > 0) return { ok: false, errors };

    const [group] = await tx
      .insert(schema.permissionGroup)
      .values({ name })
      .returning({ id: schema.permissionGroup.id });
    if (!group) throw new Error("permission group insert returned no row");
    await addMembers(tx, group.id, addPermissions, addUsers);
    return { ok: true, id: group.id };
  });
}

export async function updatePermissionGroup(
  db: Executor,
  requestor: Requestor,
  groupId: string,
  input: PermissionGroupUpdateInput,
): Promise<StaffResult> {
  const name = input.name?.trim();
  const addPermissions = distinct(input.addPermissions);
  const removePermissions = distinct(input.removePermissions);
  const addUsers = distinct(input.addUsers);
  const removeUsers = distinct(input.removeUsers);

  return db.transaction(async (tx) => {
    const [group] = await loadGroups(tx, [groupId]);
    if (!group) throw new NotFoundError("Group", [groupId]);
    // Checked first and alone, as Saleor: a group beyond the requestor's scope is off limits.
    if (outOfScope(requestor, group.permissions).length > 0) {
      return {
        ok: false,
        errors: [
          { field: null, code: "OUT_OF_SCOPE_PERMISSION", message: MESSAGES.groupOutOfScope },
        ],
      };
    }

    const errors: StaffError[] = [
      ...checkDuplicates(addPermissions, removePermissions, "permissions"),
      ...checkDuplicates(addUsers, removeUsers, "users"),
    ];
    if (name !== undefined) {
      const nameError = checkName(name);
      if (nameError) errors.push(nameError);
      else if (await groupNameTaken(tx, name, groupId)) {
        errors.push({ field: "name", code: "UNIQUE", message: MESSAGES.groupNameTaken });
      }
    }
    errors.push(...checkPermissionsInScope(requestor, addPermissions, "addPermissions"));
    errors.push(...checkPermissionsInScope(requestor, removePermissions, "removePermissions"));
    errors.push(...checkStaff(await loadUsers(tx, addUsers), "addUsers"));

    await loadUsers(tx, removeUsers);
    if (!requestor.isSuperuser) {
      const outOfScopeUsers: string[] = [];
      for (const userId of removeUsers) {
        const theirs = await getEffectivePermissions(tx, userId);
        if (outOfScope(requestor, theirs).length > 0) outOfScopeUsers.push(userId);
      }
      if (outOfScopeUsers.length > 0) {
        errors.push({
          field: "removeUsers",
          code: "OUT_OF_SCOPE_USER",
          message: MESSAGES.usersOutOfScope,
          users: outOfScopeUsers,
        });
      }
    }
    if (removeUsers.includes(requestor.id) && (await isOnlyGroupOf(tx, requestor.id, groupId))) {
      errors.push({
        field: "removeUsers",
        code: "CANNOT_REMOVE_FROM_LAST_GROUP",
        message: MESSAGES.lastGroup,
        users: [requestor.id],
      });
    }
    if (errors.length > 0) return { ok: false, errors };

    if (name !== undefined) {
      await tx
        .update(schema.permissionGroup)
        .set({ name })
        .where(eq(schema.permissionGroup.id, groupId));
    }
    await addMembers(tx, groupId, addPermissions, addUsers);
    if (removePermissions.length > 0) {
      await tx
        .delete(schema.permissionGroupPermission)
        .where(
          and(
            eq(schema.permissionGroupPermission.groupId, groupId),
            inArray(schema.permissionGroupPermission.code, removePermissions),
          ),
        );
    }
    if (removeUsers.length > 0) {
      await tx
        .delete(schema.userPermissionGroup)
        .where(
          and(
            eq(schema.userPermissionGroup.groupId, groupId),
            inArray(schema.userPermissionGroup.userId, removeUsers),
          ),
        );
    }
    return { ok: true, id: groupId };
  });
}

/** True when `groupId` is the user's one and only group. */
async function isOnlyGroupOf(db: Executor, userId: string, groupId: string) {
  const memberships = await db
    .select({ groupId: schema.userPermissionGroup.groupId })
    .from(schema.userPermissionGroup)
    .where(eq(schema.userPermissionGroup.userId, userId));
  return memberships.length === 1 && memberships[0]?.groupId === groupId;
}

/**
 * A staff account without a password: it can log in once password reset exists (M8), as Saleor
 * sends a set-password email here.
 */
export async function createStaffUser(
  db: Executor,
  requestor: Requestor,
  input: StaffCreateInput,
): Promise<StaffResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  const addGroups = distinct(input.addGroups);

  return db.transaction(async (tx) => {
    const errors: StaffError[] = [];
    if (email === "") {
      errors.push({ field: "email", code: "REQUIRED", message: MESSAGES.blank });
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.push({ field: "email", code: "INVALID", message: MESSAGES.invalidEmail });
    } else {
      const [{ value: taken } = { value: 0 }] = await tx
        .select({ value: count() })
        .from(schema.user)
        .where(eq(schema.user.email, email));
      if (taken > 0) errors.push({ field: "email", code: "UNIQUE", message: MESSAGES.emailTaken });
    }

    const groups = await loadGroups(tx, addGroups);
    const outOfScopeGroups = groups
      .filter((g) => outOfScope(requestor, g.permissions).length > 0)
      .map((g) => g.id);
    if (outOfScopeGroups.length > 0) {
      errors.push({
        field: "addGroups",
        code: "OUT_OF_SCOPE_GROUP",
        message: MESSAGES.groupsOutOfScope,
        groups: outOfScopeGroups,
      });
    }
    if (errors.length > 0) return { ok: false, errors };

    const [user] = await tx
      .insert(schema.user)
      .values({
        email,
        firstName: input.firstName ?? "",
        lastName: input.lastName ?? "",
        isStaff: true,
        isActive: input.isActive ?? true,
      })
      .returning({ id: schema.user.id });
    if (!user) throw new Error("user insert returned no row");
    if (addGroups.length > 0) {
      await tx
        .insert(schema.userPermissionGroup)
        .values(addGroups.map((groupId) => ({ userId: user.id, groupId })));
    }
    return { ok: true, id: user.id };
  });
}
