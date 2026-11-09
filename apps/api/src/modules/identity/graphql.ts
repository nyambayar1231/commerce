import { builder } from "../../graphql/builder.ts";
import { clearedSessionCookie, sessionCookie } from "../../graphql/context.ts";
import { authenticate, createSession, revokeSession, type SessionUser } from "./index.ts";

// Login, logout and the current user. Names and shapes follow Saleor
// (saleor/graphql/account/mutations/authentication/create_token.py, saleor/graphql/account/types.py)
// except where ARCHITECTURE.md §4's deviations table says otherwise: the session token travels in
// an HttpOnly cookie, so `tokenCreate` returns no token, and `logout` is ours.

// Saleor's global ID: base64("User:<pk>").
const userGlobalId = (id: string) => Buffer.from(`User:${id}`).toString("base64");

const UserType = builder.objectRef<SessionUser>("User").implement({
  description: "Represents user data.",
  fields: (t) => ({
    id: t.id({ resolve: (user) => userGlobalId(user.id) }),
    email: t.exposeString("email"),
    firstName: t.exposeString("firstName"),
    lastName: t.exposeString("lastName"),
    isStaff: t.exposeBoolean("isStaff", { description: "Determine if the user is a staff admin." }),
  }),
});

// Saleor's AccountErrorCode, limited to the codes we can return.
const AccountErrorCode = builder.enumType("AccountErrorCode", {
  values: ["INACTIVE", "INVALID_CREDENTIALS"] as const,
});

type AccountError = {
  field: string | null;
  message: string;
  code: "INACTIVE" | "INVALID_CREDENTIALS";
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
