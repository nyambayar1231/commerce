import { type Executor, schema } from "@commerce/db";
import { eq } from "drizzle-orm";

// Staff permissions (ARCHITECTURE.md §8), as Saleor's `User.effective_permissions`
// (../saleor-core/saleor/account/models.py): a superuser has every permission, anyone else the
// union of their groups' permissions. Saleor's per-user permissions are left out: groups only.
// An inactive user has none, as Django's ModelBackend (Saleor's auth checks this at login).

export type Permission = schema.Permission;
export const PERMISSIONS: readonly Permission[] = schema.PERMISSIONS;

// Saleor's display names (the `permissions` Meta of each owning model, e.g.
// ../saleor-core/saleor/product/models.py), returned as `UserPermission.name`.
export const PERMISSION_NAMES: Record<Permission, string> = {
  MANAGE_PRODUCTS: "Manage products.",
  MANAGE_ORDERS: "Manage orders.",
  MANAGE_CHECKOUTS: "Manage checkouts",
  MANAGE_USERS: "Manage customers.",
  MANAGE_STAFF: "Manage staff.",
  MANAGE_SETTINGS: "Manage settings.",
  MANAGE_SHIPPING: "Manage shipping.",
};

/** The user's effective permissions in enum order; empty for an unknown or inactive user. */
export async function getEffectivePermissions(db: Executor, userId: string): Promise<Permission[]> {
  const [user] = await db
    .select({ isActive: schema.user.isActive, isSuperuser: schema.user.isSuperuser })
    .from(schema.user)
    .where(eq(schema.user.id, userId));

  if (!user?.isActive) return [];
  if (user.isSuperuser) return [...PERMISSIONS];

  const rows = await db
    .selectDistinct({ code: schema.permissionGroupPermission.code })
    .from(schema.userPermissionGroup)
    .innerJoin(
      schema.permissionGroupPermission,
      eq(schema.permissionGroupPermission.groupId, schema.userPermissionGroup.groupId),
    )
    .where(eq(schema.userPermissionGroup.userId, userId));

  const granted = new Set(rows.map((row) => row.code));
  return PERMISSIONS.filter((code) => granted.has(code));
}
