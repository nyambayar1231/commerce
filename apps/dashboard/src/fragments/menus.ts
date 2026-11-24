// Adapted from saleor-dashboard: src/fragments/navigation.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's menu fragments, limited to our fields: no metadata, no translations and no `parent`
// (the tree is built from `children`). GraphQL has no recursive fragments, so the nesting stops at
// the API's own limit of three levels (0-2); Saleor's fragment repeats six times.
import { gql } from "@apollo/client";

// The list row: the name and every item id (top level and two levels down), so the grid can count
// the whole tree — the API's `Menu.items` returns the top level only.
export const menuFragment = gql`
  fragment Menu on Menu {
    id
    name
    items {
      id
      children {
        id
        children {
          id
        }
      }
    }
  }
`;

export const menuItemFragment = gql`
  fragment MenuItem on MenuItem {
    category {
      id
      name
    }
    collection {
      id
      name
    }
    id
    level
    name
    page {
      id
      title
    }
    url
  }
`;

export const menuItemNestedFragment = gql`
  fragment MenuItemNested on MenuItem {
    ...MenuItem
    children {
      ...MenuItem
      children {
        ...MenuItem
      }
    }
  }
  ${menuItemFragment}
`;

export const menuDetailsFragment = gql`
  fragment MenuDetails on Menu {
    id
    items {
      ...MenuItemNested
    }
    name
  }
  ${menuItemNestedFragment}
`;
