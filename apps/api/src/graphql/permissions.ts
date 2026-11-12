import { GraphQLError } from "graphql";
import type { Permission } from "../modules/identity/index.ts";
import type { Context } from "./context.ts";

// The staff permission check (ARCHITECTURE.md §8). Every guarded field and mutation calls it at
// the top of its resolver, in plain sight (deliberately not a Pothos auth plugin):
//
//   resolve: async (_parent, args, ctx) => {
//     await requirePermission(ctx, "MANAGE_STAFF");
//     ...
//   }
//
// As Saleor's `one_of_permissions_or_auth_filter_required`: the user needs ANY ONE of the listed
// permissions. A denial is a top-level GraphQL error (not a payload error), with Saleor's message
// and `extensions.exception.code` (../saleor-core/saleor/core/exceptions.py PermissionDenied,
// saleor/graphql/utils/__init__.py format_error). Yoga doesn't mask a GraphQLError.

// Saleor also lists its authorization filters, e.g. OWNER for a resource the user owns.
export function permissionDenied(permissions: readonly (Permission | "OWNER")[]): GraphQLError {
  return new GraphQLError(
    `To access this path, you need one of the following permissions: ${permissions.join(", ")}`,
    { extensions: { exception: { code: "PermissionDenied" } } },
  );
}

export async function requirePermission(
  ctx: Pick<Context, "user" | "permissions">,
  ...required: [Permission, ...Permission[]]
): Promise<void> {
  // Only staff hold permissions (group membership is staff-only); this keeps a customer out even
  // if that invariant were ever broken.
  if (ctx.user?.isStaff) {
    const granted = await ctx.permissions();
    if (required.some((code) => granted.includes(code))) return;
  }
  throw permissionDenied(required);
}
