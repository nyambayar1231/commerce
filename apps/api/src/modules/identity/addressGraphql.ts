import type { AddressInput as AddressInputData } from "@commerce/contracts";
import { AddressInput, AddressType } from "../../graphql/address.ts";
import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { fromGlobalId } from "../../graphql/globalId.ts";
import { permissionDenied } from "../../graphql/permissions.ts";
import { AddressTypeEnum } from "../checkout/graphql.ts";
import { type AccountError, AccountErrorType, UserType } from "./graphql.ts";
import {
  type AddressBookEntry,
  type AddressBookError,
  addressNotFoundError,
  createUserAddress,
  deleteUserAddress,
  getUserAddresses,
  getUserDefaultAddress,
  type SessionUser,
  setDefaultUserAddress,
  updateUserAddress,
} from "./index.ts";

// Saleor's customer address book (PLAN M15.2): the AccountAddressCreate / Update / Delete and
// AccountSetDefaultAddress mutations and the User address fields (saleor/graphql/account/types.py,
// mutations/account/account_address_*.py). Each mutation acts on the logged-in user's own book
// only; an id that is not one of their addresses is NOT_FOUND, the same for a foreign, unknown or
// malformed id. Staff address mutations and the `customerId` impersonation argument are out of
// scope (the dashboard's customer address card comes later).

const AUTHENTICATED_USER = "Requires one of the following permissions: AUTHENTICATED_USER.";
const OWNER = "Requires one of the following permissions: MANAGE_USERS, IS_OWNER.";
const USER_ADDRESSES = "Requires one of the following permissions: OWNER, MANAGE_USERS.";

const toErrors = (errors: readonly AddressBookError[]): AccountError[] =>
  errors.map(({ field, code, message }) => ({ field, code, message }));

function requireUser(ctx: Context): SessionUser {
  if (!ctx.user) throw permissionDenied(["AUTHENTICATED_USER"]);
  return ctx.user;
}

/** An address id of this type, or null for a malformed one (reported as NOT_FOUND, not a crash). */
function decodeAddressId(globalId: string): string | null {
  try {
    return fromGlobalId("Address", globalId);
  } catch {
    return null;
  }
}

/** Pothos' input object as the contracts' AddressInput (the same cast shippingGraphql uses). */
const toAddressInput = (input: Record<string, string | null | undefined>): AddressInputData =>
  input as AddressInputData;

/** The user's own addresses, or anyone's for staff holding MANAGE_USERS (as `User.orders`). */
async function requireUserOrManageUsers(user: SessionUser, ctx: Context): Promise<void> {
  if (ctx.user?.id === user.id) return;
  const granted = ctx.user?.isStaff ? await ctx.permissions() : [];
  if (!granted.includes("MANAGE_USERS")) throw permissionDenied(["OWNER", "MANAGE_USERS"]);
}

builder.objectFields(UserType, (t) => ({
  addresses: t.field({
    type: [AddressType],
    description: `List of all user's addresses.\n\n${USER_ADDRESSES}`,
    resolve: async (user, _args, ctx) => {
      await requireUserOrManageUsers(user, ctx);
      return getUserAddresses(ctx.db, user.id);
    },
  }),
  defaultShippingAddress: t.field({
    type: AddressType,
    nullable: true,
    description: "The default shipping address of the user.",
    resolve: async (user, _args, ctx) => {
      await requireUserOrManageUsers(user, ctx);
      return getUserDefaultAddress(ctx.db, user.id, "SHIPPING");
    },
  }),
  defaultBillingAddress: t.field({
    type: AddressType,
    nullable: true,
    description: "The default billing address of the user.",
    resolve: async (user, _args, ctx) => {
      await requireUserOrManageUsers(user, ctx);
      return getUserDefaultAddress(ctx.db, user.id, "BILLING");
    },
  }),
}));

type AddressPayload = {
  user: SessionUser | null;
  address: AddressBookEntry | null;
  errors: AccountError[];
};

const addressPayload = (name: string, description: string) =>
  builder.objectRef<AddressPayload>(name).implement({
    description,
    fields: (t) => ({
      user: t.field({ type: UserType, nullable: true, resolve: (p) => p.user }),
      errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
      address: t.field({ type: AddressType, nullable: true, resolve: (p) => p.address }),
    }),
  });

const AccountAddressCreateType = addressPayload(
  "AccountAddressCreate",
  addressPayloadDescription("Create a new address for the customer.", AUTHENTICATED_USER),
);
const AccountAddressUpdateType = addressPayload(
  "AccountAddressUpdate",
  addressPayloadDescription("Updates an address of the logged-in user.", OWNER),
);
const AccountAddressDeleteType = addressPayload(
  "AccountAddressDelete",
  addressPayloadDescription("Deletes an address of the logged-in user.", OWNER),
);

function addressPayloadDescription(action: string, permissions: string): string {
  return `${action}\n\n${permissions}`;
}

type SetDefaultPayload = { user: SessionUser | null; errors: AccountError[] };

const AccountSetDefaultAddressType = builder
  .objectRef<SetDefaultPayload>("AccountSetDefaultAddress")
  .implement({
    description: `Sets a default address for the authenticated user.\n\n${AUTHENTICATED_USER}`,
    fields: (t) => ({
      user: t.field({ type: UserType, nullable: true, resolve: (p) => p.user }),
      errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
    }),
  });

builder.mutationField("accountAddressCreate", (t) =>
  t.field({
    type: AccountAddressCreateType,
    description: `Create a new address for the customer.\n\n${AUTHENTICATED_USER}`,
    args: {
      input: t.arg({
        type: AddressInput,
        required: true,
        description: "Fields required to create address.",
      }),
      type: t.arg({
        type: AddressTypeEnum,
        description:
          "A type of address. If provided, the new address will be automatically assigned as " +
          "the customer's default address of that type.",
      }),
    },
    resolve: async (_parent, { input, type }, ctx) => {
      const user = requireUser(ctx);
      const result = await createUserAddress(ctx.db, user.id, toAddressInput(input), type ?? null);
      return result.ok
        ? { user, address: result.address, errors: [] }
        : { user: null, address: null, errors: toErrors(result.errors) };
    },
  }),
);

builder.mutationField("accountAddressUpdate", (t) =>
  t.field({
    type: AccountAddressUpdateType,
    description: `Updates an address of the logged-in user. ${OWNER}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of the address to update." }),
      input: t.arg({
        type: AddressInput,
        required: true,
        description: "Fields required to update the address.",
      }),
    },
    resolve: async (_parent, { id, input }, ctx) => {
      const user = requireUser(ctx);
      const addressId = decodeAddressId(String(id));
      if (addressId === null) {
        return { user: null, address: null, errors: toErrors([addressNotFoundError()]) };
      }
      const result = await updateUserAddress(ctx.db, user.id, addressId, toAddressInput(input));
      return result.ok
        ? { user, address: result.address, errors: [] }
        : { user: null, address: null, errors: toErrors(result.errors) };
    },
  }),
);

builder.mutationField("accountAddressDelete", (t) =>
  t.field({
    type: AccountAddressDeleteType,
    description: `Deletes an address of the logged-in user. ${OWNER}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of the address to delete." }),
    },
    resolve: async (_parent, { id }, ctx) => {
      const user = requireUser(ctx);
      const addressId = decodeAddressId(String(id));
      if (addressId === null) {
        return { user: null, address: null, errors: toErrors([addressNotFoundError()]) };
      }
      const result = await deleteUserAddress(ctx.db, user.id, addressId);
      return result.ok
        ? { user, address: result.address, errors: [] }
        : { user: null, address: null, errors: toErrors(result.errors) };
    },
  }),
);

builder.mutationField("accountSetDefaultAddress", (t) =>
  t.field({
    type: AccountSetDefaultAddressType,
    description: `Sets a default address for the authenticated user.\n\n${AUTHENTICATED_USER}`,
    args: {
      id: t.arg.id({ required: true, description: "ID of the address to set as default." }),
      type: t.arg({
        type: AddressTypeEnum,
        required: true,
        description: "The type of address.",
      }),
    },
    resolve: async (_parent, { id, type }, ctx) => {
      const user = requireUser(ctx);
      const addressId = decodeAddressId(String(id));
      if (addressId === null) {
        return { user: null, errors: toErrors([addressNotFoundError()]) };
      }
      const result = await setDefaultUserAddress(ctx.db, user.id, addressId, type);
      return result.ok ? { user, errors: [] } : { user: null, errors: toErrors(result.errors) };
    },
  }),
);
