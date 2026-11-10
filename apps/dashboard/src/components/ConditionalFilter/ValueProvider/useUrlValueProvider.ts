// Adapted from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/useUrlValueProvider.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The URL is the single source of truth. The URL's category IDs are looked up so the rows show
// names; everything else comes straight from the URL tokens. Apply writes the filter entries back,
// keeping `query`, `sort` and `asc` and dropping the page cursor as Saleor does. Saleor's `qs` is
// replaced by our TokenArray.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import type { InitialProductAPIState } from "../API/initialState/product/useProductInitialAPIState";
import { cloneFilterContainer, type FilterContainer } from "../FilterElement/FilterElement";
import type { FilterValueProvider } from "../FilterValueProvider";
import { stringifyFilterQuery, TokenArray } from "./TokenArray";
import { prepareStructure } from "./utils";

const buildSearch = (
  filters: FilterContainer,
  current: URLSearchParams,
  keepQuery = true,
): string => {
  const params = new URLSearchParams();
  const filterParams = new URLSearchParams(stringifyFilterQuery(prepareStructure(filters)));

  for (const [key, value] of filterParams) {
    params.append(key, value);
  }

  for (const key of keepQuery ? ["query", "sort", "asc"] : ["sort", "asc"]) {
    const value = current.get(key);

    if (value) {
      params.set(key, value);
    }
  }

  return params.toString();
};

export const useUrlValueProvider = (
  locationSearch: string,
  initialState: InitialProductAPIState,
): FilterValueProvider => {
  const navigate = useNavigate();
  const location = useLocation();
  const tokenizedUrl = useMemo(() => new TokenArray(locationSearch), [locationSearch]);
  const fetchingParams = useMemo(() => tokenizedUrl.getFetchingParams(), [tokenizedUrl]);
  const [value, setValue] = useState<FilterContainer>([]);
  const { data, loading, fetchQueries } = initialState;

  // Fetch the names of the categories the URL names; other fields need no lookup.
  useEffect(() => {
    void fetchQueries(fetchingParams);
  }, [fetchQueries, fetchingParams]);

  // Rebuild the rows from the URL once the lookup finishes (Saleor's two effects).
  useEffect(() => {
    if (loading) return;

    setValue(tokenizedUrl.asFilterValuesFromResponse(data));
  }, [data, loading, tokenizedUrl]);

  const persist = (filterValue: FilterContainer) => {
    navigate(
      {
        pathname: location.pathname,
        search: buildSearch(filterValue, new URLSearchParams(location.search)),
      },
      { replace: true },
    );
    setValue(cloneFilterContainer(filterValue));
  };

  const clear = () => {
    navigate(
      {
        pathname: location.pathname,
        search: buildSearch([], new URLSearchParams(location.search), false),
      },
      { replace: true },
    );
    setValue([]);
  };

  const count = value.filter((entry) => typeof entry !== "string").length;

  return {
    value,
    loading,
    persist,
    clear,
    count,
  };
};
