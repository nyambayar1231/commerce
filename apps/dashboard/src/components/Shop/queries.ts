// Adapted from saleor-dashboard: src/components/Shop/queries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ShopInfo, limited to the fields our API has.
import { gql } from "@apollo/client";

export const shopInfo = gql`
  query ShopInfo {
    shop {
      name
    }
  }
`;
