// Adapted from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/useUrlValueProvider.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The URL is the single source of truth. Values come straight from the URL tokens (no initial
// API state); Apply writes the filter entries back, keeping `query`, `sort` and `asc` and
// dropping the page cursor as Saleor does. Saleor's `qs` is replaced by our TokenArray.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

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

export const useUrlValueProvider = (locationSearch: string): FilterValueProvider => {
  const navigate = useNavigate();
  const location = useLocation();
  const tokenizedUrl = useMemo(() => new TokenArray(locationSearch), [locationSearch]);
  const [value, setValue] = useState<FilterContainer>(() => tokenizedUrl.asFilterContainer());

  useEffect(() => {
    setValue(tokenizedUrl.asFilterContainer());
  }, [tokenizedUrl]);

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
    loading: false,
    persist,
    clear,
    count,
  };
};
