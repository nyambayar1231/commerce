import { schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { builder } from "../../graphql/builder.ts";
import { type Context, clearedSessionCookie, sessionCookie } from "../../graphql/context.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { matchOrdersWithNewUser } from "../orders/index.ts";
import {
  type AccountRegisterErrorCode,
  authenticate,
  cleanAccountRegisterInput,
  createPermissionGroup,
  createSession,
  createStaffUser,
  getEffectivePermissions,
  hashRegistrationPassword,
  NotFoundError,
  PERMISSION_NAMES,
  PERMISSIONS,
  type Permission,
  type Requestor,
  registerCustomer,
  revokeSession,
  type SessionUser,
  type StaffError,
  type StaffResult,
  updatePermissionGroup,
} from "./index.ts";

// Login, logout and the current user. Names and shapes follow Saleor
// (saleor/graphql/account/mutations/authentication/create_token.py, saleor/graphql/account/types.py)
// except where ARCHITECTURE.md §4's deviations table says otherwise: the session token travels in
// an HttpOnly cookie, so `tokenCreate` returns no token, and `logout` is ours.

// Saleor's PermissionEnum, limited to our closed set (ARCHITECTURE.md §8).
const PermissionEnum = builder.enumType("PermissionEnum", { values: PERMISSIONS });

// Saleor's UserPermission (saleor/graphql/account/types.py); its `sourcePermissionGroups` is added
// when the staff pages (admin phase) need it.
const UserPermissionType = builder.objectRef<Permission>("UserPermission").implement({
  description: "Represents user's permissions.",
  fields: (t) => ({
    code: t.field({
      type: PermissionEnum,
      description: "Internal code for permission.",
      resolve: (code) => code,
    }),
    name: t.string({
      description: "Describe action(s) allowed to do by permission.",
      resolve: (code) => PERMISSION_NAMES[code],
    }),
  }),
});

// Relay nodes (implement Node), as Saleor's User and Group.
export const UserType = builder.node(builder.objectRef<SessionUser>("User"), {
  id: { resolve: (user) => user.id },
  description: "Represents user data.",
  fields: (t) => ({
    email: t.exposeString("email"),
    firstName: t.exposeString("firstName"),
    lastName: t.exposeString("lastName"),
    isStaff: t.exposeBoolean("isStaff", { description: "Determine if the user is a staff admin." }),
    // Nullable list of non-null items, as Saleor's NonNullList.
    userPermissions: t.field({
      type: [UserPermissionType],
      nullable: { list: true, items: false },
      description: "List of user's permissions.",
      // The current user's are already cached on the request.
      resolve: (user, _args, ctx) =>
        user.id === ctx.user?.id ? ctx.permissions() : getEffectivePermissions(ctx.db, user.id),
    }),
  }),
});

// Saleor's AccountErrorCode, limited to the codes we can return.
const AccountErrorCode = builder.enumType("AccountErrorCode", {
  values: [
    "INACTIVE",
    "INVALID",
    "INVALID_CREDENTIALS",
    "OUT_OF_SCOPE_GROUP",
    "PASSWORD_TOO_SHORT",
    "REQUIRED",
    "UNIQUE",
  ] as const,
});

type AccountError = {
  field: string | null;
  message: string;
  code: "INACTIVE" | "INVALID_CREDENTIALS" | AccountRegisterErrorCode;
};

const AccountErrorType = builder.objectRef<AccountError>("AccountError").implement({
  description: "Represents errors in account mutations.",
  fields: (t) => ({
    field: t.exposeString("field", {
      nullable: true,
      description: "Name of a field that caused the error. `null` if it isn't tied to one field.",
    }),
    message: t.exposeString("message", { description: "The error message." }),
    code: t.field({ type: AccountErrorCode, resolve: (error) => error.code }),
  }),
});

// Saleor's messages for these codes.
const MESSAGES = {
  INVALID_CREDENTIALS: "Please, enter valid credentials",
  INACTIVE: "Account inactive.",
} as const;

type TokenCreatePayload = { user: SessionUser | null; errors: AccountError[] };

const TokenCreateType = builder.objectRef<TokenCreatePayload>("CreateToken").implement({
  description: "Log in: on success, sets the HttpOnly session cookie and returns the user.",
  fields: (t) => ({
    user: t.field({ type: UserType, nullable: true, resolve: (p) => p.user }),
    errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
  }),
});

builder.mutationField("tokenCreate", (t) =>
  t.field({
    type: TokenCreateType,
    description: "Log in with email and password.",
    args: {
      email: t.arg.string({ required: true, description: "Email of a user." }),
      password: t.arg.string({ required: true, description: "Password of a user." }),
    },
    resolve: async (_parent, { email, password }, context) => {
      const result = await authenticate(context.db, email, password);
      if (!result.ok) {
        return {
          user: null,
          errors: [{ field: "email", code: result.code, message: MESSAGES[result.code] }],
        };
      }
      // A new login replaces the session the request came with.
      if (context.sessionToken !== null) await revokeSession(context.db, context.sessionToken);
      const session = await createSession(context.db, result.user.id);
      context.setCookie(sessionCookie(session.token, session.expiresAt));
      return { user: result.user, errors: [] };
    },
  }),
);

type LogoutPayload = { errors: AccountError[] };

const LogoutType = builder.objectRef<LogoutPayload>("Logout").implement({
  description: "Log out: ends the current session and clears the cookie.",
  fields: (t) => ({
    errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
  }),
});

builder.mutationField("logout", (t) =>
  t.field({
    type: LogoutType,
    description: "End the current session. Succeeds when there is none.",
    resolve: async (_parent, _args, context) => {
      if (context.sessionToken !== null) await revokeSession(context.db, context.sessionToken);
      context.setCookie(clearedSessionCookie());
      return { errors: [] };
    },
  }),
);

builder.queryField("me", (t) =>
  t.field({
    type: UserType,
    nullable: true,
    description: "Return the currently authenticated user.",
    resolve: (_parent, _args, context) => context.user,
  }),
);

// --- Customer registration (PLAN M7.1): Saleor's accountRegister with email confirmation off.
// The account module creates the user; the orders module links the email's guest orders, both in
// one transaction so a new account never misses them. Left out: Saleor's deprecated `user` payload
// field (always an object built from the input, without an id), `accountErrors`, `redirectUrl`,
// `languageCode`, `metadata` and `channel` (no confirmation email until M8).

type AccountRegisterPayload = { requiresConfirmation: boolean; errors: AccountError[] };

const AccountRegisterType = builder.objectRef<AccountRegisterPayload>("AccountRegister").implement({
  description: "Register a new user.",
  fields: (t) => ({
    requiresConfirmation: t.exposeBoolean("requiresConfirmation", {
      description: "Informs whether users need to confirm their email address.",
    }),
    errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
  }),
});

const AccountRegisterInput = builder.inputType("AccountRegisterInput", {
  description: "Fields required to create a user.",
  fields: (t) => ({
    firstName: t.string({ description: "Given name." }),
    lastName: t.string({ description: "Family name." }),
    email: t.string({ required: true, description: "The email address of the user." }),
    password: t.string({ required: true, description: "Password." }),
  }),
});

builder.mutationField("accountRegister", (t) =>
  t.field({
    type: AccountRegisterType,
    description:
      "Register a new user. The answer is the same whether or not the email is already " +
      "registered; log in with tokenCreate afterwards.",
    args: {
      input: t.arg({
        type: AccountRegisterInput,
        required: true,
        description: "Fields required to create a user.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      const cleaned = cleanAccountRegisterInput(input);
      if (!cleaned.ok) return { requiresConfirmation: false, errors: cleaned.errors };
      const passwordHash = await hashRegistrationPassword(input.password);
      await ctx.db.transaction(async (tx) => {
        const result = await registerCustomer(tx, input, passwordHash);
        if (result.ok && result.userId !== null) {
          await matchOrdersWithNewUser(tx, result.userId, result.email);
        }
      });
      return { requiresConfirmation: false, errors: [] };
    },
  }),
);

// --- Staff management (M1.2.3): Saleor's permissionGroupCreate / permissionGroupUpdate /
// staffCreate, each guarded by MANAGE_STAFF. Channels, metadata, notes, redirectUrl and the
// deprecated `*Errors` payload fields are left out.

// Saleor's Permission (saleor/graphql/core/types/common.py).
const PermissionType = builder.objectRef<Permission>("Permission").implement({
  description: "Represents a permission object in a friendly form.",
  fields: (t) => ({
    code: t.field({
      type: PermissionEnum,
      description: "Internal code for permission.",
      resolve: (code) => code,
    }),
    name: t.string({
      description: "Describe action(s) allowed to do by permission.",
      resolve: (code) => PERMISSION_NAMES[code],
    }),
  }),
});

const USER_COLUMNS = {
  id: schema.user.id,
  email: schema.user.email,
  firstName: schema.user.firstName,
  lastName: schema.user.lastName,
  isStaff: schema.user.isStaff,
  isSuperuser: schema.user.isSuperuser,
};

type GroupModel = { id: string; name: string };

// Saleor's Group (saleor/graphql/account/types.py), without channels and `userCanManage`.
const GroupType = builder.node(builder.objectRef<GroupModel>("Group"), {
  id: { resolve: (group) => group.id },
  description: "Represents permission group data.",
  fields: (t) => ({
    name: t.exposeString("name"),
    permissions: t.field({
      type: [PermissionType],
      nullable: { list: true, items: false },
      description: "List of group permissions",
      resolve: async (group, _args, ctx) => {
        const rows = await ctx.db
          .select({ code: schema.permissionGroupPermission.code })
          .from(schema.permissionGroupPermission)
          .where(eq(schema.permissionGroupPermission.groupId, group.id));
        return PERMISSIONS.filter((code) => rows.some((row) => row.code === code));
      },
    }),
    users: t.field({
      type: [UserType],
      nullable: { list: true, items: false },
      description: "List of group users",
      resolve: (group, _args, ctx) =>
        ctx.db
          .select(USER_COLUMNS)
          .from(schema.userPermissionGroup)
          .innerJoin(schema.user, eq(schema.user.id, schema.userPermissionGroup.userId))
          .where(eq(schema.userPermissionGroup.groupId, group.id))
          .orderBy(schema.user.email),
    }),
  }),
});

// Saleor's PermissionGroupErrorCode, without the channel code.
const PermissionGroupErrorCode = builder.enumType("PermissionGroupErrorCode", {
  values: [
    "ASSIGN_NON_STAFF_MEMBER",
    "CANNOT_REMOVE_FROM_LAST_GROUP",
    "DUPLICATED_INPUT_ITEM",
    "OUT_OF_SCOPE_PERMISSION",
    "OUT_OF_SCOPE_USER",
    "REQUIRED",
    "UNIQUE",
  ] as const,
});

const globalIds = (kind: "User" | "Group", ids: string[] | undefined) =>
  ids?.map((id) => toGlobalId(kind, id)) ?? null;

const PermissionGroupErrorType = builder.objectRef<StaffError>("PermissionGroupError").implement({
  fields: (t) => ({
    field: t.exposeString("field", {
      nullable: true,
      description: "Name of a field that caused the error. `null` if it isn't tied to one field.",
    }),
    message: t.exposeString("message", { description: "The error message." }),
    code: t.field({
      type: PermissionGroupErrorCode,
      description: "The error code.",
      resolve: (error) => error.code as (typeof PermissionGroupErrorCode)["$inferType"],
    }),
    permissions: t.field({
      type: [PermissionEnum],
      nullable: { list: true, items: false },
      description: "List of permissions which causes the error.",
      resolve: (error) => error.permissions ?? null,
    }),
    users: t.idList({
      nullable: { list: true, items: false },
      description: "List of user IDs which causes the error.",
      resolve: (error) => globalIds("User", error.users),
    }),
  }),
});

const StaffErrorType = builder.objectRef<StaffError>("StaffError").implement({
  fields: (t) => ({
    field: t.exposeString("field", {
      nullable: true,
      description: "Name of a field that caused the error. `null` if it isn't tied to one field.",
    }),
    message: t.exposeString("message", { description: "The error message." }),
    code: t.field({
      type: AccountErrorCode,
      description: "The error code.",
      resolve: (error) => error.code as (typeof AccountErrorCode)["$inferType"],
    }),
    permissions: t.field({
      type: [PermissionEnum],
      nullable: { list: true, items: false },
      description: "List of permission codes which causes the error.",
      resolve: (error) => error.permissions ?? null,
    }),
    groups: t.idList({
      nullable: { list: true, items: false },
      description: "List of permission group IDs which cause the error.",
      resolve: (error) => globalIds("Group", error.groups),
    }),
    users: t.idList({
      nullable: { list: true, items: false },
      description: "List of user IDs which causes the error.",
      resolve: (error) => globalIds("User", error.users),
    }),
  }),
});

type GroupPayload = { group: GroupModel | null; errors: StaffError[] };

const groupPayload = (name: string, description: string) =>
  builder.objectRef<GroupPayload>(name).implement({
    description,
    fields: (t) => ({
      errors: t.field({ type: [PermissionGroupErrorType], resolve: (p) => p.errors }),
      group: t.field({ type: GroupType, nullable: true, resolve: (p) => p.group }),
    }),
  });

const PermissionGroupCreateType = groupPayload(
  "PermissionGroupCreate",
  "Create new permission group. Requires one of the following permissions: MANAGE_STAFF.",
);
const PermissionGroupUpdateType = groupPayload(
  "PermissionGroupUpdate",
  "Update permission group. Requires one of the following permissions: MANAGE_STAFF.",
);

type StaffCreatePayload = { user: SessionUser | null; errors: StaffError[] };

const StaffCreateType = builder.objectRef<StaffCreatePayload>("StaffCreate").implement({
  description: "Creates a new staff user. Requires one of the following permissions: MANAGE_STAFF.",
  fields: (t) => ({
    errors: t.field({ type: [StaffErrorType], resolve: (p) => p.errors }),
    user: t.field({ type: UserType, nullable: true, resolve: (p) => p.user }),
  }),
});

const PermissionGroupCreateInput = builder.inputType("PermissionGroupCreateInput", {
  fields: (t) => ({
    addPermissions: t.field({
      type: [PermissionEnum],
      description: "List of permission code names to assign to this group.",
    }),
    addUsers: t.idList({ description: "List of users to assign to this group." }),
    name: t.string({ required: true, description: "Group name." }),
  }),
});

const PermissionGroupUpdateInput = builder.inputType("PermissionGroupUpdateInput", {
  fields: (t) => ({
    addPermissions: t.field({
      type: [PermissionEnum],
      description: "List of permission code names to assign to this group.",
    }),
    addUsers: t.idList({ description: "List of users to assign to this group." }),
    name: t.string({ description: "Group name." }),
    removePermissions: t.field({
      type: [PermissionEnum],
      description: "List of permission code names to unassign from this group.",
    }),
    removeUsers: t.idList({ description: "List of users to unassign from this group." }),
  }),
});

const StaffCreateInput = builder.inputType("StaffCreateInput", {
  description: "Fields required to create a staff user.",
  fields: (t) => ({
    addGroups: t.idList({
      description: "List of permission group IDs to which user should be assigned.",
    }),
    email: t.string({ description: "The unique email address of the user." }),
    firstName: t.string({ description: "Given name." }),
    isActive: t.boolean({ description: "User account is active." }),
    lastName: t.string({ description: "Family name." }),
  }),
});

/** MANAGE_STAFF, then who is asking (the requestor of Saleor's scope checks). */
async function staffRequestor(ctx: Context): Promise<Requestor> {
  await requirePermission(ctx, "MANAGE_STAFF");
  const user = ctx.user as SessionUser; // requirePermission refused anonymous requests
  return { id: user.id, isSuperuser: user.isSuperuser, permissions: await ctx.permissions() };
}

const userIds = (ids: readonly (string | number)[] | null | undefined) =>
  ids?.map((id) => fromGlobalId("User", String(id))) ?? [];

/** Runs a staff-management call, turning unknown ids into Saleor's top-level error. */
async function run(call: () => Promise<StaffResult>): Promise<StaffResult> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId(error.kind, id)));
    }
    throw error;
  }
}

async function loadGroup(ctx: Context, id: string): Promise<GroupModel> {
  const [group] = await ctx.db
    .select({ id: schema.permissionGroup.id, name: schema.permissionGroup.name })
    .from(schema.permissionGroup)
    .where(eq(schema.permissionGroup.id, id));
  if (!group) throw new Error(`permission group ${id} vanished`);
  return group;
}

builder.mutationField("permissionGroupCreate", (t) =>
  t.field({
    type: PermissionGroupCreateType,
    description:
      "Create new permission group. Requires one of the following permissions: MANAGE_STAFF.",
    args: {
      input: t.arg({
        type: PermissionGroupCreateInput,
        required: true,
        description: "Input fields to create permission group.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      const requestor = await staffRequestor(ctx);
      const result = await run(() =>
        createPermissionGroup(ctx.db, requestor, {
          name: input.name,
          addPermissions: input.addPermissions ?? [],
          addUsers: userIds(input.addUsers),
        }),
      );
      return result.ok
        ? { group: await loadGroup(ctx, result.id), errors: [] }
        : { group: null, errors: result.errors };
    },
  }),
);

builder.mutationField("permissionGroupUpdate", (t) =>
  t.field({
    type: PermissionGroupUpdateType,
    description:
      "Update permission group. Requires one of the following permissions: MANAGE_STAFF.",
    args: {
      id: t.arg.id({ required: true, description: "ID of the group to update." }),
      input: t.arg({
        type: PermissionGroupUpdateInput,
        required: true,
        description: "Input fields to create permission group.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      const requestor = await staffRequestor(ctx);
      const groupId = fromGlobalId("Group", String(id));
      const result = await run(() =>
        updatePermissionGroup(ctx.db, requestor, groupId, {
          name: input.name,
          addPermissions: input.addPermissions ?? [],
          removePermissions: input.removePermissions ?? [],
          addUsers: userIds(input.addUsers),
          removeUsers: userIds(input.removeUsers),
        }),
      );
      return result.ok
        ? { group: await loadGroup(ctx, result.id), errors: [] }
        : { group: null, errors: result.errors };
    },
  }),
);

builder.mutationField("staffCreate", (t) =>
  t.field({
    type: StaffCreateType,
    description:
      "Creates a new staff user. Requires one of the following permissions: MANAGE_STAFF.",
    args: {
      input: t.arg({
        type: StaffCreateInput,
        required: true,
        description: "Fields required to create a staff user.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      const requestor = await staffRequestor(ctx);
      const result = await run(() =>
        createStaffUser(ctx.db, requestor, {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          isActive: input.isActive,
          addGroups: input.addGroups?.map((g) => fromGlobalId("Group", String(g))) ?? [],
        }),
      );
      if (!result.ok) return { user: null, errors: result.errors };
      const [user] = await ctx.db
        .select(USER_COLUMNS)
        .from(schema.user)
        .where(eq(schema.user.id, result.id));
      return { user: user ?? null, errors: [] };
    },
  }),
);
