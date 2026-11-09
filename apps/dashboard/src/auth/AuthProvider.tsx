// Adapted from saleor-dashboard: src/auth/AuthProvider.tsx and src/auth/hooks/useAuthProvider.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The current user comes from `me`, which the API answers from the session cookie. Saleor keeps
// JWTs client-side and refreshes them; with a cookie there is nothing to store or refresh. Saleor's
// external (OIDC) login and "remember credentials" are left out.
import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { createContext, type ReactNode, useContext, useState } from "react";

import {
  LogoutDocument,
  TokenCreateDocument,
  UserDetailsDocument,
  type UserDetailsQuery,
} from "../graphql/types.generated";

export type User = NonNullable<UserDetailsQuery["me"]>;

// Saleor's UserContextError (src/auth/types.ts), limited to the cases we can hit.
export type UserContextError =
  | "loginError"
  | "invalidCredentials"
  | "noPermissionsError"
  | "serverError"
  | "unknownLoginError";

interface UserContext {
  user: User | null;
  // True while the first `me` is in flight: the app shows LoginLoading instead of the login page.
  authenticating: boolean;
  // True while a login request is in flight.
  loggingIn: boolean;
  errors: UserContextError[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContext | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const client = useApolloClient();
  const { data, loading, error } = useQuery(UserDetailsDocument);
  const [tokenCreate, { loading: loggingIn }] = useMutation(TokenCreateDocument);
  const [logoutMutation] = useMutation(LogoutDocument);
  const [errors, setErrors] = useState<UserContextError[]>([]);

  const setUser = (user: User | null) =>
    client.writeQuery({ query: UserDetailsDocument, data: { __typename: "Query", me: user } });

  const logout = async () => {
    try {
      await logoutMutation();
    } finally {
      // Drop everything cached for this user, then mark the app as signed out.
      await client.clearStore();
      setUser(null);
    }
  };

  const login = async (email: string, password: string) => {
    setErrors([]);
    try {
      const result = await tokenCreate({ variables: { email, password } });
      const payload = result.data?.tokenCreate;
      if (!payload) {
        setErrors(["unknownLoginError"]);
        return;
      }
      if (payload.errors.length > 0 || !payload.user) {
        // As Saleor: INVALID_CREDENTIALS gets its own case, anything else (INACTIVE) is a
        // generic login error; both read "Your username and/or password are incorrect".
        setErrors(
          payload.errors.map((e) =>
            e.code === "INVALID_CREDENTIALS" ? "invalidCredentials" : "loginError",
          ),
        );
        return;
      }
      // The dashboard is for staff only (Saleor's logoutNonStaffUser).
      if (!payload.user.isStaff) {
        await logout();
        setErrors(["noPermissionsError"]);
        return;
      }
      setUser(payload.user);
    } catch {
      setErrors(["serverError"]);
    }
  };

  const value: UserContext = {
    // A failed `me` (API down) leaves the user signed out, with the error on the login page.
    user: data?.me ?? null,
    authenticating: loading && !data,
    loggingIn,
    errors: error && errors.length === 0 ? ["serverError"] : errors,
    login,
    logout,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

/** Saleor's src/auth/useUser.ts. */
export const useUser = (): UserContext => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used inside AuthProvider");
  return context;
};
