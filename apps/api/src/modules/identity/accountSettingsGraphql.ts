import { builder } from "../../graphql/builder.ts";
import type { Context } from "../../graphql/context.ts";
import { permissionDenied } from "../../graphql/permissions.ts";
import { type AccountError, AccountErrorType, UserType } from "./graphql.ts";
import {
  type AccountSettingsError,
  changePassword,
  type SessionUser,
  updateAccount,
} from "./index.ts";

// The storefront's account settings page (M15.2): Saleor's accountUpdate and passwordChange
// (saleor/graphql/account/mutations/account/account_update.py,
// mutations/authentication/password_change.py). Both act on the logged-in user only. Left out:
// Saleor's `customerId` impersonation argument, default addresses (the address book mutations
// cover them), languageCode and metadata.

const AUTHENTICATED_USER = "Requires one of the following permissions: AUTHENTICATED_USER.";

const toErrors = (errors: readonly AccountSettingsError[]): AccountError[] =>
  errors.map(({ field, code, message }) => ({ field, code, message }));

function requireUser(ctx: Context): SessionUser {
  if (!ctx.user) throw permissionDenied(["AUTHENTICATED_USER"]);
  return ctx.user;
}

const AccountInput = builder.inputType("AccountInput", {
  description: "Fields required to update the user.",
  fields: (t) => ({
    firstName: t.string({ description: "Given name." }),
    lastName: t.string({ description: "Family name." }),
  }),
});

type AccountUpdatePayload = { user: SessionUser | null; errors: AccountError[] };

const AccountUpdateType = builder.objectRef<AccountUpdatePayload>("AccountUpdate").implement({
  description: `Updates the account of the logged-in user.\n\n${AUTHENTICATED_USER}`,
  fields: (t) => ({
    user: t.field({
      type: UserType,
      nullable: true,
      description: "A user instance.",
      resolve: (p) => p.user,
    }),
    errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
  }),
});

builder.mutationField("accountUpdate", (t) =>
  t.field({
    type: AccountUpdateType,
    description: `Updates the account of the logged-in user.\n\n${AUTHENTICATED_USER}`,
    args: {
      input: t.arg({
        type: AccountInput,
        required: true,
        description: "Fields required to update the account of the logged-in user.",
      }),
    },
    resolve: async (_parent, { input }, ctx) => {
      const user = requireUser(ctx);
      const result = await updateAccount(ctx.db, user.id, {
        firstName: input.firstName,
        lastName: input.lastName,
      });
      return result.ok
        ? { user: result.user, errors: [] }
        : { user: null, errors: toErrors(result.errors) };
    },
  }),
);

type PasswordChangePayload = { user: SessionUser | null; errors: AccountError[] };

const PasswordChangeType = builder.objectRef<PasswordChangePayload>("PasswordChange").implement({
  description: `Change the password of the logged in user.\n\n${AUTHENTICATED_USER}`,
  fields: (t) => ({
    user: t.field({
      type: UserType,
      nullable: true,
      description: "A user instance with a new password.",
      resolve: (p) => p.user,
    }),
    errors: t.field({ type: [AccountErrorType], resolve: (p) => p.errors }),
  }),
});

builder.mutationField("passwordChange", (t) =>
  t.field({
    type: PasswordChangeType,
    description: `Change the password of the logged in user.\n\n${AUTHENTICATED_USER}`,
    args: {
      oldPassword: t.arg.string({ description: "Current user password." }),
      newPassword: t.arg.string({ required: true, description: "New user password." }),
    },
    resolve: async (_parent, { oldPassword, newPassword }, ctx) => {
      const user = requireUser(ctx);
      // The request's session token is set whenever `user` is (graphql/context.ts).
      const sessionToken = ctx.sessionToken;
      if (sessionToken === null) throw permissionDenied(["AUTHENTICATED_USER"]);
      const result = await ctx.db.transaction((tx) =>
        changePassword(tx, user.id, sessionToken, { oldPassword, newPassword }),
      );
      return result.ok
        ? { user: result.user, errors: [] }
        : { user: null, errors: toErrors(result.errors) };
    },
  }),
);
