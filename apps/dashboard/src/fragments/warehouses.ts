// Adapted from saleor-dashboard: src/fragments/warehouses.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's Warehouse and Stock fragments: the stock rows the variant page's Inventory card reads.
// `quantityAllocated` feeds the table's Allocated column; the warehouse's name titles a variant
// grid column on the product page.
import { gql } from "@apollo/client";

export const warehouseFragment = gql`
  fragment Warehouse on Warehouse {
    id
    name
  }
`;

export const stockFragment = gql`
  fragment Stock on Stock {
    id
    quantity
    quantityAllocated
    warehouse {
      ...Warehouse
    }
  }
  ${warehouseFragment}
`;
