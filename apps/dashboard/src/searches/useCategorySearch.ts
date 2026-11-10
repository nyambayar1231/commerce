// Adapted from saleor-dashboard: src/searches/useCategorySearch.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The update page's category picker: the first 20 categories, a debounced search, and the next
// page when the combobox scrolls to the end. Saleor's makeTopLevelSearch is not built yet, so the
// hook talks to Apollo directly; the operation lives in products/queries.ts so codegen sees it.
import { useQuery } from "@apollo/client";
import type { Option } from "@saleor/macaw-ui";
import { useState } from "react";

import { SearchCategoriesDocument } from "../graphql/types.generated";
import useDebounce from "../hooks/useDebounce";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 200;

export const useCategorySearch = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce<string>((value) => setSearch(value), SEARCH_DEBOUNCE_MS);

  const filter = search ? { search } : undefined;
  const { data, loading, fetchMore } = useQuery(SearchCategoriesDocument, {
    variables: { first: PAGE_SIZE, filter },
  });

  const pageInfo = data?.search?.pageInfo;
  const categories: Option[] =
    data?.search?.edges.map(({ node }) => ({ value: node.id, label: node.name })) ?? [];

  const loadMore = () => {
    if (loading || !pageInfo?.hasNextPage || !pageInfo.endCursor) {
      return;
    }

    void fetchMore({
      variables: { first: PAGE_SIZE, after: pageInfo.endCursor, filter },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult?.search) {
          return previous;
        }

        return {
          __typename: "Query",
          search: {
            ...fetchMoreResult.search,
            edges: [...(previous.search?.edges ?? []), ...fetchMoreResult.search.edges],
          },
        };
      },
    });
  };

  return {
    categories,
    loading,
    hasNextPage: pageInfo?.hasNextPage ?? false,
    search: debouncedSearch,
    loadMore,
  };
};
