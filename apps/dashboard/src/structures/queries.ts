// Adapted from saleor-dashboard: src/structures/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's menu list and details queries, plus the item dialog's link search. The search asks
// categories, collections and pages in one request: the dialog groups the three result lists.
import { gql } from "@apollo/client";

import { menuDetailsFragment, menuFragment } from "../fragments/menus";
import { pageInfoFragment } from "../fragments/pageInfo";

export const menuList = gql`
  query MenuList(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filter: MenuFilterInput
    $sort: MenuSortingInput
  ) {
    menus(
      first: $first
      after: $after
      last: $last
      before: $before
      filter: $filter
      sortBy: $sort
    ) {
      edges {
        node {
          ...Menu
        }
      }
      pageInfo {
        ...PageInfo
      }
    }
  }
  ${menuFragment}
  ${pageInfoFragment}
`;

export const menuDetails = gql`
  query MenuDetails($id: ID!) {
    menu(id: $id) {
      ...MenuDetails
    }
  }
  ${menuDetailsFragment}
`;

// Saleor's useCategorySearch/useCollectionSearch/usePageSearch for the item dialog, in one round
// trip. The first page of each kind is enough for a combobox filter.
export const menuItemLinkSearch = gql`
  query MenuItemLinkSearch($first: Int!, $search: String) {
    categories(first: $first, filter: { search: $search }) {
      edges {
        node {
          id
          name
        }
      }
    }
    collections(first: $first, filter: { search: $search }) {
      edges {
        node {
          id
          name
        }
      }
    }
    pages(first: $first, filter: { search: $search }) {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;
