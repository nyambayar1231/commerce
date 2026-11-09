// Adapted from saleor-dashboard: src/categories/views/CategoryList/services/categoryChildrenQueries.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { ApolloClient } from "@apollo/client";
import {
  CategoryChildrenDocument,
  type CategoryChildrenQuery,
  type CategoryChildrenQueryVariables,
  type CategoryFragment,
} from "../../../../graphql/types.generated";
import { mapEdgesToItems } from "../../../../utils/maps";

export const SUBCATEGORIES_PAGE_SIZE = 50;

export interface CategoryChildrenPageResult {
  children: CategoryFragment[];
  hasNextPage: boolean;
  endCursor: string | null;
}

const getCategoryChildrenVariables = (
  parentId: string,
  after: string | null = null,
): CategoryChildrenQueryVariables => ({
  id: parentId,
  first: SUBCATEGORIES_PAGE_SIZE,
  after,
});

const mapCategoryChildrenPageResult = (
  data: CategoryChildrenQuery | undefined,
): CategoryChildrenPageResult | undefined => {
  const connection = data?.category?.children;

  if (!connection) {
    return undefined;
  }

  return {
    children: mapEdgesToItems(connection) ?? [],
    hasNextPage: connection.pageInfo?.hasNextPage ?? false,
    endCursor: connection.pageInfo?.endCursor ?? null,
  };
};

export const readCategoryChildrenPageFromCache = (
  client: ApolloClient<object>,
  parentId: string,
  after: string | null = null,
): CategoryChildrenPageResult | null => {
  try {
    const cached = client.readQuery<CategoryChildrenQuery, CategoryChildrenQueryVariables>({
      query: CategoryChildrenDocument,
      variables: getCategoryChildrenVariables(parentId, after),
    });

    return mapCategoryChildrenPageResult(cached ?? undefined) ?? null;
  } catch {
    return null;
  }
};

export const fetchCategoryChildrenPage = async (
  client: ApolloClient<object>,
  parentId: string,
  after: string | null = null,
): Promise<CategoryChildrenPageResult | undefined> => {
  const response = await client.query<CategoryChildrenQuery, CategoryChildrenQueryVariables>({
    query: CategoryChildrenDocument,
    variables: getCategoryChildrenVariables(parentId, after),
    fetchPolicy: "network-only",
  });

  return mapCategoryChildrenPageResult(response.data);
};
