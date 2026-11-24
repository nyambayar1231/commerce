// Adapted from saleor-dashboard: src/structures/mutations.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's mutations for the list and the menu screen. `menuUpdate` carries the name and the
// pending tree moves in one document, as Saleor's (its MenuDetails sends both on Save); items are
// created, edited and deleted one at a time.
import { gql } from "@apollo/client";

export const menuErrorFragment = gql`
  fragment MenuError on MenuError {
    code
    field
    message
  }
`;

export const menuCreate = gql`
  mutation MenuCreate($input: MenuCreateInput!) {
    menuCreate(input: $input) {
      menu {
        id
      }
      errors {
        ...MenuError
      }
    }
  }
  ${menuErrorFragment}
`;

export const menuUpdate = gql`
  mutation MenuUpdate($id: ID!, $input: MenuInput!, $moves: [MenuItemMoveInput!]!) {
    menuUpdate(id: $id, input: $input) {
      menu {
        id
      }
      errors {
        ...MenuError
      }
    }
    menuItemMove(menu: $id, moves: $moves) {
      errors {
        ...MenuError
      }
    }
  }
  ${menuErrorFragment}
`;

export const menuDelete = gql`
  mutation MenuDelete($id: ID!) {
    menuDelete(id: $id) {
      errors {
        ...MenuError
      }
    }
  }
  ${menuErrorFragment}
`;

export const menuBulkDelete = gql`
  mutation MenuBulkDelete($ids: [ID!]!) {
    menuBulkDelete(ids: $ids) {
      count
      errors {
        ...MenuError
      }
    }
  }
  ${menuErrorFragment}
`;

export const menuItemCreate = gql`
  mutation MenuItemCreate($input: MenuItemCreateInput!) {
    menuItemCreate(input: $input) {
      menuItem {
        id
      }
      errors {
        ...MenuError
      }
    }
  }
  ${menuErrorFragment}
`;

export const menuItemUpdate = gql`
  mutation MenuItemUpdate($id: ID!, $input: MenuItemInput!) {
    menuItemUpdate(id: $id, input: $input) {
      menuItem {
        id
      }
      errors {
        ...MenuError
      }
    }
  }
  ${menuErrorFragment}
`;

export const menuItemDelete = gql`
  mutation MenuItemDelete($id: ID!) {
    menuItemDelete(id: $id) {
      menuItem {
        id
      }
      errors {
        ...MenuError
      }
    }
  }
  ${menuErrorFragment}
`;
