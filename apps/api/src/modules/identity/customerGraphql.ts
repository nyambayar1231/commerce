import { GraphQLError } from "graphql";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId, nodesNotFound, toGlobalId } from "../../graphql/globalId.ts";
import { isEdgesRequested, validatePagination } from "../../graphql/pagination.ts";
import { requirePermission } from "../../graphql/permissions.ts";
import { DateTime } from "../../graphql/scalars.ts";
import { OrderDirection } from "../catalog/graphql.ts";
import { matchOrdersWithNewUser } from "../orders/index.ts";
import { type AccountError, AccountErrorType, UserType } from "./graphql.ts";
import {
  type CustomerError,
  createCustomer,
  deleteCustomers,
  getUserForStaff,
  getUsersByIds,
  InvalidCustomerCursorError,
  listCustomers,
  NotFoundError,
  type SessionUser,
  type UserSortField,
  updateCustomer,
} from "./index.ts";

// Staff customer management (PLAN M7.3): Saleor's `customers`, `user(id)`, customerCreate,
// customerUpdate, customerDelete and customerBulkDelete (saleor/graphql/account/schema.py,
// mutations/staff/, bulk_mutations/), plus the User fields the dashboard's customer pages read.
// Unknown ids are Saleor's top-level node error, as in the staff mutations. Left out: notes,
// metadata, addresses, customer types, attributes, external references, `isConfirmed`, and
// `user(email:)`/`user(externalReference:)`.

const MANAGE_USERS = "Requires one of the following permissions: MANAGE_USERS.";

// Saleor's User fields for the customer pages.
builder.objectFields(UserType, (t) => ({
  isActive: t.exposeBoolean("isActive", { description: "Determine if the user is active." }),
  dateJoined: t.field({
    type: DateTime,
    description: "The date when the user joined.",
    resolve: (user) => user.createdAt,
  }),
  updatedAt: t.field({
    type: DateTime,
    description: "The date when the user was last updated.",
    resolve: (user) => user.updatedAt,
  }),
  lastLogin: t.field({
    type: DateTime,
    nullable: true,
    description: "The date when the user last logged in.",
    resolve: (user) => user.lastLogin,
  }),
}));

const UserSortFieldEnum = builder.enumType("UserSortField", {
  values: {
    FIRST_NAME: { description: "Sort users by first name." },
    LAST_NAME: { description: "Sort users by last name." },
    EMAIL: { description: "Sort users by email." },
    ORDER_COUNT: { description: "Sort users by order count." },
    CREATED_AT: { description: "Sort users by created at." },
    LAST_MODIFIED_AT: { description: "Sort users by last modified at." },
  } as const,
});

const UserSortingInput = builder.inputType("UserSortingInput", {
  fields: (t) => ({
    direction: t.field({
      type: OrderDirection,
      required: true,
      description: "Specifies the direction in which to sort users.",
    }),
    field: t.field({
      type: UserSortFieldEnum,
      required: true,
      description: "Sort users by the selected field.",
    }),
  }),
});

const UserConnection = builder.connectionObject(
  {
    type: UserType,
    name: "UserCountableConnection",
    fields: (t) => ({
      totalCount: t.int({
        nullable: true,
        description: "A total count of items in the collection.",
        resolve: (connection) => (connection as unknown as { totalCount: number }).totalCount,
      }),
    }),
  },
  { name: "UserCountableEdge" },
);

builder.queryField("customers", (t) =>
  t.connection(
    {
      type: UserType,
      nullable: true,
      description:
        "List of the shop's customers. This list includes all users who registered through the " +
        "accountRegister mutation. Additionally, staff users who have placed an order using " +
        "their account will also appear in this list.\n\nRequires one of the following " +
        "permissions: MANAGE_ORDERS, MANAGE_USERS.",
      args: {
        sortBy: t.arg({ type: UserSortingInput, description: "Sort customers." }),
        search: t.arg.string({ description: "Search customers." }),
      },
      resolve: async (_parent, { sortBy, search, ...args }, ctx, info) => {
        await requirePermission(ctx, "MANAGE_ORDERS", "MANAGE_USERS");
        const page = validatePagination("customers", args, isEdgesRequested(info));
        try {
          const result = await listCustomers(ctx.db, {
            ...args,
            ...page,
            search,
            sort: sortBy
              ? { field: sortBy.field as UserSortField, direction: sortBy.direction }
              : null,
          });
          return {
            ...result,
            edges: result.rows,
            pageInfo: {
              hasNextPage: result.hasNextPage,
              hasPreviousPage: result.hasPreviousPage,
              startCursor: result.rows[0]?.cursor ?? null,
              endCursor: result.rows.at(-1)?.cursor ?? null,
            },
          };
        } catch (error) {
          if (error instanceof InvalidCustomerCursorError) throw new GraphQLError(error.message);
          throw error;
        }
      },
    },
    UserConnection,
  ),
);

builder.queryField("user", (t) =>
  t.field({
    type: UserType,
    nullable: true,
    description:
      "Look up a user by ID.\n\nRequires one of the following permissions: MANAGE_STAFF, " +
      "MANAGE_USERS, MANAGE_ORDERS.",
    args: { id: t.arg.id({ required: true, description: "ID of the user." }) },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_STAFF", "MANAGE_USERS", "MANAGE_ORDERS");
      return getUserForStaff(ctx.db, fromGlobalId("User", String(id)), await ctx.permissions());
    },
  }),
);

// --- Mutations (MANAGE_USERS)

const CustomerInputFields = (name: string, description: string) =>
  builder.inputType(name, {
    description,
    fields: (t) => ({
      firstName: t.string({ description: "Given name." }),
      lastName: t.string({ description: "Family name." }),
      email: t.string({ description: "The unique email address of the user." }),
      isActive: t.boolean({ description: "User account is active." }),
    }),
  });

const UserCreateInput = CustomerInputFields("UserCreateInput", "Fields required to create a user.");
const CustomerInput = CustomerInputFields("CustomerInput", "Fields required to update a user.");

type UserPayload = { user: SessionUser | null; errors: AccountError[] };

const userPayload = (name: string, description: string) =>
  builder.objectRef<UserPayload>(name).implement({
    description,
    fields: (t) => ({
      errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
      user: t.field({ type: UserType, nullable: true, resolve: (p) => p.user }),
    }),
  });

const CustomerCreateType = userPayload(
  "CustomerCreate",
  `Creates a new customer.\n\n${MANAGE_USERS}`,
);
const CustomerUpdateType = userPayload(
  "CustomerUpdate",
  `Updates an existing customer.\n\n${MANAGE_USERS}`,
);
const CustomerDeleteType = userPayload("CustomerDelete", `Deletes a customer.\n\n${MANAGE_USERS}`);

type BulkPayload = { count: number; errors: AccountError[] };

const CustomerBulkDeleteType = builder.objectRef<BulkPayload>("CustomerBulkDelete").implement({
  description: `Deletes customers.\n\n${MANAGE_USERS}`,
  fields: (t) => ({
    count: t.exposeInt("count", { description: "Returns how many objects were affected." }),
    errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
  }),
});

const toErrors = (errors: readonly CustomerError[]): AccountError[] =>
  errors.map(({ field, code, message }) => ({ field, code, message }));

/** Unknown user ids become Saleor's top-level node error. */
async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw nodesNotFound(error.ids.map((id) => toGlobalId(error.kind, id)));
    }
    throw error;
  }
}

const loadUser = async (ctx: Context, id: string) => (await getUsersByIds(ctx.db, [id]))[0] ?? null;

builder.mutationField("customerCreate", (t) =>
  t.field({
    type: CustomerCreateType,
    nullable: true,
    description: `Creates a new customer.\n\n${MANAGE_USERS}`,
    args: {
      input: t.arg({
        type: UserCreateInput,
        required: true,
        description: "Fields required to create a customer.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      await requirePermission(ctx, "MANAGE_USERS");
      const result = await createCustomer(ctx.db, input);
      if (!result.ok) return { user: null, errors: toErrors(result.errors) };
      return { user: await loadUser(ctx, result.id), errors: [] };
    },
  }),
);

builder.mutationField("customerUpdate", (t) =>
  t.field({
    type: CustomerUpdateType,
    nullable: true,
    description: `Updates an existing customer.\n\n${MANAGE_USERS}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of a customer to update." }),
      input: t.arg({
        type: CustomerInput,
        required: true,
        description: "Fields required to update a customer.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      await requirePermission(ctx, "MANAGE_USERS");
      const userId = fromGlobalId("User", String(id));
      // Saleor links the new email's guest orders when the email changes; same transaction.
      const result = await run(() =>
        ctx.db.transaction(async (tx) => {
          const updated = await updateCustomer(tx, userId, input);
          if (updated.ok && updated.emailChanged) {
            await matchOrdersWithNewUser(tx, updated.id, updated.email);
          }
          return updated;
        }),
      );
      if (!result.ok) return { user: null, errors: toErrors(result.errors) };
      return { user: await loadUser(ctx, result.id), errors: [] };
    },
  }),
);

builder.mutationField("customerDelete", (t) =>
  t.field({
    type: CustomerDeleteType,
    nullable: true,
    description: `Deletes a customer.\n\n${MANAGE_USERS}`,
    args: { id: t.arg.id({ required: true, description: "ID of a customer to delete." }) },
    resolve: async (_parent, { id }, ctx) => {
      await requirePermission(ctx, "MANAGE_USERS");
      const requester = ctx.user as SessionUser; // requirePermission refused anonymous requests
      const result = await run(() =>
        deleteCustomers(ctx.db, requester.id, [fromGlobalId("User", String(id))]),
      );
      // As Saleor's delete mutations, the payload carries the deleted user's data.
      return { user: result.deleted[0] ?? null, errors: toErrors(result.errors) };
    },
  }),
);

builder.mutationField("customerBulkDelete", (t) =>
  t.field({
    type: CustomerBulkDeleteType,
    nullable: true,
    description: `Deletes customers.\n\n${MANAGE_USERS}`,
    args: { ids: t.arg.idList({ required: true, description: "List of user IDs to delete." }) },
    resolve: async (_parent, { ids }, ctx) => {
      await requirePermission(ctx, "MANAGE_USERS");
      const requester = ctx.user as SessionUser;
      const result = await run(() =>
        deleteCustomers(
          ctx.db,
          requester.id,
          ids.map((id) => fromGlobalId("User", String(id))),
        ),
      );
      // Saleor's bulk errors name the refused node in `field`; the others are deleted.
      return {
        count: result.deleted.length,
        errors: result.errors.map((error) => ({
          field: toGlobalId("User", error.userId),
          code: error.code,
          message: error.message,
        })),
      };
    },
  }),
);
