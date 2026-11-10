// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/providers/ProductFilterAPIProvider.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor resolves the row's left operand through FilterQueryVarsBuilderResolver and builds a
// handler per field. Only the category field has API options, so that is the only branch.
import { useApolloClient } from "@apollo/client";

import type { FilterContainer } from "../../FilterElement/FilterElement";
import type { FilterAPIProvider } from "../FilterAPIProvider";
import { emptyChoicesPage, fetchHandlerPage } from "../filterChoicesPage";
import { CategoryHandler } from "../Handler";
import { getFilterElement } from "../utils";

export const useProductFilterAPIProvider = (): FilterAPIProvider => {
  const client = useApolloClient();

  const fetchRightOptions = async (
    position: string,
    value: FilterContainer,
    inputValue: string,
    after?: string | null,
  ) => {
    const index = parseInt(position, 10);
    const filterElement = getFilterElement(value, index);

    if (filterElement.value.value !== "category") {
      return emptyChoicesPage();
    }

    const handler = new CategoryHandler(client, inputValue);

    return fetchHandlerPage(handler, after);
  };

  return {
    fetchRightOptions,
  };
};
