import { describe, expect, it } from "vitest";

import type { PermissionEnum } from "../graphql/types.generated";
import type { User } from "./AuthProvider";
import { hasAllPermissions, hasAnyPermissions, hasPermission } from "./misc";

const userWith = (userPermissions: PermissionEnum[] | null): User => ({
  __typename: "User",
  id: "VXNlcjox",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Example",
  isStaff: true,
  userPermissions:
    userPermissions?.map((code) => ({
      __typename: "UserPermission",
      code,
      name: code,
    })) ?? null,
});

describe("hasPermission", () => {
  it("returns true when the user has the permission", () => {
    expect(hasPermission("MANAGE_PRODUCTS", userWith(["MANAGE_PRODUCTS"]))).toBe(true);
  });

  it("returns false when the user does not have the permission", () => {
    expect(hasPermission("MANAGE_PRODUCTS", userWith(["MANAGE_ORDERS"]))).toBe(false);
  });

  it("returns false for a user without any permissions", () => {
    expect(hasPermission("MANAGE_PRODUCTS", userWith([]))).toBe(false);
  });

  it("returns false when the user's permissions are null", () => {
    expect(hasPermission("MANAGE_PRODUCTS", userWith(null))).toBe(false);
  });
});

describe("hasAnyPermissions", () => {
  it("returns true when the user has any one of the permissions", () => {
    expect(hasAnyPermissions(["MANAGE_ORDERS", "MANAGE_STAFF"], userWith(["MANAGE_STAFF"]))).toBe(
      true,
    );
  });

  it("returns false when the user has none of the permissions", () => {
    expect(
      hasAnyPermissions(["MANAGE_ORDERS", "MANAGE_STAFF"], userWith(["MANAGE_PRODUCTS"])),
    ).toBe(false);
  });

  it("returns false for a user without any permissions", () => {
    expect(hasAnyPermissions(["MANAGE_ORDERS"], userWith([]))).toBe(false);
  });

  it("returns false for an empty permission list", () => {
    expect(hasAnyPermissions([], userWith(["MANAGE_PRODUCTS"]))).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  it("returns true when the user has all of the permissions", () => {
    expect(
      hasAllPermissions(
        ["MANAGE_ORDERS", "MANAGE_STAFF"],
        userWith(["MANAGE_STAFF", "MANAGE_ORDERS"]),
      ),
    ).toBe(true);
  });

  it("returns false when the user has only some of the permissions", () => {
    expect(hasAllPermissions(["MANAGE_ORDERS", "MANAGE_STAFF"], userWith(["MANAGE_STAFF"]))).toBe(
      false,
    );
  });

  it("returns true for an empty permission list", () => {
    expect(hasAllPermissions([], userWith([]))).toBe(true);
  });
});
