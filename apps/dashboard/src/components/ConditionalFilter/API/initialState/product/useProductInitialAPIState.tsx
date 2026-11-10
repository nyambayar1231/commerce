// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/initialState/product/useProductInitialAPIState.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Loads the names behind the URL's filter values so a reloaded category row shows labels. Saleor
// runs a query per operand (channels, collections, product types, attributes, reference
// attributes…); our only async value is the category, looked up by global IDs (Saleor uses slugs).
import { useApolloClient } from "@apollo/client";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";

import {
  _SearchCategoriesOperandsDocument,
  type _SearchCategoriesOperandsQuery,
  type _SearchCategoriesOperandsQueryVariables,
} from "../../../../../graphql/types.generated";
import { useNotifier } from "../../../../../hooks/useNotifier/useNotifier";
import { createOptionsFromAPI } from "../../Handler";
import { InitialProductStateResponse } from "./InitialProductStateResponse";

export interface FetchingParams {
  /** Category global IDs from the URL. */
  category: string[];
}

export interface InitialProductAPIState {
  data: InitialProductStateResponse;
  loading: boolean;
  fetchQueries: (params: FetchingParams) => Promise<void>;
}

export const useProductInitialAPIState = (): InitialProductAPIState => {
  const client = useApolloClient();
  const notify = useNotifier();
  const intl = useIntl();
  const [data, setData] = useState<InitialProductStateResponse>(
    InitialProductStateResponse.empty(),
  );
  const [loading, setLoading] = useState(true);

  const fetchQueries = useCallback(
    async ({ category }: FetchingParams) => {
      setLoading(true);

      try {
        const categoryOptions =
          category.length === 0
            ? []
            : createOptionsFromAPI(
                (
                  await client.query<
                    _SearchCategoriesOperandsQuery,
                    _SearchCategoriesOperandsQueryVariables
                  >({
                    query: _SearchCategoriesOperandsDocument,
                    variables: {
                      ids: category,
                      first: category.length,
                    },
                  })
                ).data.categories?.edges ?? [],
              );

        setData(new InitialProductStateResponse(categoryOptions));
      } catch (error) {
        console.error("Failed to fetch filter initial data:", error);
        notify({
          status: "error",
          text: intl.formatMessage({
            id: "aHIrs/",
            defaultMessage: "Failed to load filter data. Please refresh page to try again.",
          }),
        });
      } finally {
        setLoading(false);
      }
    },
    [client, intl, notify],
  );

  return {
    data,
    loading,
    fetchQueries,
  };
};
