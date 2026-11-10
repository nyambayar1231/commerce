// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/Handler.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One handler per async operand. Only the category handler is kept: it is the only filter whose
// options come from the API (attributes, collections, product types and the rest are dropped).
import type { ApolloClient } from "@apollo/client";

import {
  _GetCategoriesChoicesDocument,
  type _GetCategoriesChoicesQuery,
  type _GetCategoriesChoicesQueryVariables,
} from "../../../graphql/types.generated";
import type { ItemOption } from "../FilterElement/ConditionValue";
import {
  FILTER_CHOICES_PAGE_SIZE,
  type FilterChoicesPageInfo,
  NO_MORE_CHOICES,
  pageInfoFromConnection,
} from "./filterChoicesPage";

export interface Handler {
  fetch: (after?: string | null) => Promise<ItemOption[]>;
  pageInfo?: FilterChoicesPageInfo;
}

/**
 * Saleor maps `value: node.id` and `slug: node.slug`. Our filter URL holds global IDs (decided in
 * M2.3.2), so the option's `slug` — the value written to the URL — is the category's global ID.
 * The category's own slug is not needed by the filter.
 */
export const createOptionsFromAPI = (
  data: Array<{
    node: {
      id: string;
      name: string | null;
    };
  }>,
): ItemOption[] =>
  data.map(({ node }) => ({
    label: node.name ?? "",
    value: node.id,
    slug: node.id,
  }));

export class CategoryHandler implements Handler {
  public pageInfo: FilterChoicesPageInfo = NO_MORE_CHOICES;

  constructor(
    public client: ApolloClient<unknown>,
    public query: string,
  ) {}

  fetch = async (after?: string | null) => {
    const { data } = await this.client.query<
      _GetCategoriesChoicesQuery,
      _GetCategoriesChoicesQueryVariables
    >({
      query: _GetCategoriesChoicesDocument,
      variables: {
        first: FILTER_CHOICES_PAGE_SIZE,
        after,
        query: this.query,
      },
    });

    this.pageInfo = pageInfoFromConnection(data.categories);

    return createOptionsFromAPI(data.categories?.edges ?? []);
  };
}
