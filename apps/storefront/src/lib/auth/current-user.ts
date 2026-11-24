import "server-only";

import { cache } from "react";
import { MeDocument } from "@/gql/graphql";
import { sessionQuery } from "@/lib/api";
import { readSessionToken } from "./cookies";
import type { CurrentUser } from "./types";

/**
 * Who is signed in, once per request (ARCHITECTURE §10.8). No cookie means a guest without asking
 * the API. A cookie the API no longer knows reads as a guest; an API outage reads as
 * `unavailable`, never as "signed out". A staff session is treated as a guest (defensive: login
 * refuses staff, so this should not happen).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  if ((await readSessionToken()) === null) return { status: "guest" };
  const result = await sessionQuery(MeDocument);
  if (!result.ok) return { status: "unavailable" };
  const me = result.data.me;
  if (me === null || me.isStaff) return { status: "guest" };
  return {
    status: "authenticated",
    user: { id: me.id, email: me.email, firstName: me.firstName, lastName: me.lastName },
  };
});
