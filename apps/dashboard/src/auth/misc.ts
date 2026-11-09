// Adapted from saleor-dashboard: src/auth/misc.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { PermissionEnum } from "../graphql/types.generated";
import type { User } from "./AuthProvider";

export const hasPermission = (permission: PermissionEnum, user: User) =>
  (user.userPermissions ?? []).map((perm) => perm.code).includes(permission);

// As Saleor: `some` over an empty list is false, `every` over an empty list is true.
export const hasAnyPermissions = (permissions: PermissionEnum[], user: User) =>
  permissions.some((permission) => hasPermission(permission, user));

export const hasAllPermissions = (permissions: PermissionEnum[], user: User) =>
  permissions.every((permission) => hasPermission(permission, user));
