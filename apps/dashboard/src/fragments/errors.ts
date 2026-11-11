// Adapted from saleor-dashboard: src/fragments/errors.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { gql } from "@apollo/client";

export const productErrorFragment = gql`
  fragment ProductError on ProductError {
    code
    field
    message
  }
`;

// Saleor's stock error fragments: BulkStockError for the stock create/update payloads (it carries
// the position in the input list) and StockError for the delete payload.
export const bulkStockErrorFragment = gql`
  fragment BulkStockError on BulkStockError {
    field
    message
    code
    index
  }
`;

export const productVariantStocksDeleteErrorFragment = gql`
  fragment ProductVariantStocksDeleteError on StockError {
    field
    message
    code
  }
`;
