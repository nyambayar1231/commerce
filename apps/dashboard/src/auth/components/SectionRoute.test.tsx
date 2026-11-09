// @vitest-environment jsdom
// Adapted from saleor-dashboard: src/auth/components/SectionRoute.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleProvider } from "../../components/Locale/Locale";
import { type PermissionEnum, UserDetailsDocument } from "../../graphql/types.generated";
import { AuthProvider } from "../AuthProvider";
import SectionRoute from "./SectionRoute";

const userDetailsMock = (userPermissions: PermissionEnum[]) => ({
  request: { query: UserDetailsDocument },
  result: {
    data: {
      __typename: "Query",
      me: {
        __typename: "User",
        id: "VXNlcjox",
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "Example",
        isStaff: true,
        userPermissions: userPermissions.map((code) => ({
          __typename: "UserPermission",
          code,
          name: code,
        })),
      },
    },
  },
});

const renderSectionRoute = ({
  permissions,
  matchPermission,
  userPermissions,
}: {
  permissions?: PermissionEnum[];
  matchPermission?: "all" | "any";
  userPermissions: PermissionEnum[];
}) =>
  render(
    // AuthProvider runs UserDetails on mount; NotFound (NotFoundPage) needs react-intl and a router.
    <MockedProvider mocks={[userDetailsMock(userPermissions)]}>
      <AuthProvider>
        <LocaleProvider>
          <MemoryRouter>
            <SectionRoute permissions={permissions} matchPermission={matchPermission}>
              <div>Section content</div>
            </SectionRoute>
          </MemoryRouter>
        </LocaleProvider>
      </AuthProvider>
    </MockedProvider>,
  );

describe("SectionRoute", () => {
  // Vitest runs without globals, so Testing Library's auto-cleanup never registers.
  afterEach(cleanup);

  it("renders the children when the user has the required permission", async () => {
    // Act
    renderSectionRoute({ permissions: ["MANAGE_PRODUCTS"], userPermissions: ["MANAGE_PRODUCTS"] });

    // Assert
    expect(await screen.findByText("Section content")).toBeTruthy();
  });

  it("renders the NotFound page when the user lacks the required permission", async () => {
    // Act
    renderSectionRoute({ permissions: ["MANAGE_PRODUCTS"], userPermissions: ["MANAGE_ORDERS"] });

    // Assert
    expect(await screen.findByText("Something's missing")).toBeTruthy();
  });

  it("renders the children when no permissions are required", async () => {
    // Act
    renderSectionRoute({ permissions: undefined, userPermissions: [] });

    // Assert
    expect(await screen.findByText("Section content")).toBeTruthy();
  });

  it("renders the children with matchPermission any when the user has one of the permissions", async () => {
    // Act
    renderSectionRoute({
      permissions: ["MANAGE_USERS", "MANAGE_STAFF"],
      matchPermission: "any",
      userPermissions: ["MANAGE_STAFF"],
    });

    // Assert
    expect(await screen.findByText("Section content")).toBeTruthy();
  });

  it("renders the NotFound page when matchPermission defaults to all and the user has only one of the permissions", async () => {
    // Act
    renderSectionRoute({
      permissions: ["MANAGE_USERS", "MANAGE_STAFF"],
      userPermissions: ["MANAGE_STAFF"],
    });

    // Assert
    expect(await screen.findByText("Something's missing")).toBeTruthy();
  });
});
