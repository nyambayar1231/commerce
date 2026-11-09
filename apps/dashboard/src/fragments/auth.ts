// Adapted from saleor-dashboard: src/fragments/auth.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's AuthUser fragment (src/fragments/auth.ts), limited to the fields our API has:
// no avatar, accessibleChannels, metadata, isActive or dateJoined yet.
import { gql } from "@apollo/client";

export const userPermissionFragment = gql`
  fragment UserPermission on UserPermission {
    code
    name
  }
`;

export const userFragment = gql`
  fragment User on User {
    id
    email
    firstName
    lastName
    isStaff
    userPermissions {
      ...UserPermission
    }
  }
`;
