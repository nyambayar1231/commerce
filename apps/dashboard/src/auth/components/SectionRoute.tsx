// Adapted from saleor-dashboard: src/auth/components/SectionRoute.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { ReactNode } from "react";

import type { PermissionEnum } from "../../graphql/types.generated";
import { NotFound } from "../../NotFound";
import { useUser } from "../AuthProvider";
import { hasAllPermissions, hasAnyPermissions } from "../misc";

type MatchPermissionType = "all" | "any";

interface SectionRouteProps {
  permissions?: PermissionEnum[];
  matchPermission?: MatchPermissionType;
  children: ReactNode;
}

// Saleor's SectionRoute wraps a <Route> (v5); React Router 7's <Routes> only accepts <Route>
// children, so ours is an element wrapper that renders `children` where Saleor renders
// <Route {...props} />. Saleor also returns null while `user === undefined` (the user query is
// still in flight); our useUser() returns `null` then, and the Dashboard renders SectionRoutes
// only with a signed-in user (App.tsx), so a null check with no special loading UI is enough.
const SectionRoute = ({ permissions, matchPermission = "all", children }: SectionRouteProps) => {
  const { user } = useUser();

  if (!user) {
    return null;
  }

  const hasSectionPermissions = () => {
    if (!permissions) {
      return true;
    }

    if (matchPermission === "all") {
      return hasAllPermissions(permissions, user);
    }

    return hasAnyPermissions(permissions, user);
  };

  return hasSectionPermissions() ? children : <NotFound />;
};

SectionRoute.displayName = "SectionRoute";
export default SectionRoute;
