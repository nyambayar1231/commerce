// Adapted from saleor-dashboard: src/products/views/ProductList/ProductList.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list with search, sort and cursor pagination, all from the URL as Saleor; a URL
// without a sort is redirected to Saleor's default (name, ascending). Not yet: filters and saved
// presets (M2.3), bulk actions and Create product (M2.4), the column picker (M2.2.6), tiles view.
import { useQuery } from "@apollo/client";
import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { ProductListDocument } from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { ProductListPage } from "../components/ProductListPage/ProductListPage";
import { getSortQueryVariables, getSortUrlParams } from "../sort";
import { parseProductListUrl, productListUrl } from "../urls";

export const ProductList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseProductListUrl(searchParams), [searchParams]);
  const { settings, updateListSettings } = useListSettings("PRODUCT_LIST");

  // Saleor's useSortRedirects: a list URL always names its sort.
  useEffect(() => {
    if (params.sort === undefined) {
      navigate(productListUrl({ ...params, sort: "name", asc: true }), { replace: true });
    }
  }, [navigate, params]);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading } = useQuery(ProductListDocument, {
    variables: {
      ...paginationState,
      search: params.query ?? null,
      sort: getSortQueryVariables(params) ?? null,
    },
    skip: params.sort === undefined,
  });
  const products = useMemo(
    () => data?.products?.edges.map((edge) => edge.node) ?? [],
    [data?.products?.edges],
  );
  const paginator = usePaginator({
    pageInfo: data?.products?.pageInfo,
    paginationState,
    queryString: { query: params.query, sort: params.sort, asc: params.asc },
  });

  // Searching, re-sorting and a new page size all start again from the first page.
  const firstPage = { after: undefined, before: undefined };

  return (
    <ProductListPage
      initialSearch={params.query ?? ""}
      onSearchChange={(query) =>
        navigate(productListUrl({ ...params, ...firstPage, query }), { replace: true })
      }
      rows={products}
      disabled={loading && !data}
      sort={{ sort: params.sort, asc: params.asc }}
      onSort={(field) =>
        navigate(productListUrl(getSortUrlParams(params, field)), { replace: true })
      }
      settings={settings}
      onUpdateListSettings={(key, value) => {
        updateListSettings(key, value);
        navigate(productListUrl({ ...params, ...firstPage }), { replace: true });
      }}
      hasNextPage={paginator.hasNextPage}
      hasPreviousPage={paginator.hasPreviousPage}
      nextHref={paginator.nextHref}
      prevHref={paginator.prevHref}
    />
  );
};
