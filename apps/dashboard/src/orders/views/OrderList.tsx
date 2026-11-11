// Adapted from saleor-dashboard: src/orders/views/OrderList/OrderList.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order list with the status filter, search, sort and cursor pagination, all from the URL as
// Saleor. Saleor's list without a sort param sorts by number, descending; we redirect such a URL to
// that sort so the column shows its arrow (as our product list does). The conditional filters in the
// URL become the query's `where`. Searching keeps the chosen sort (Saleor switches to `rank`, which
// our API answers as number). Not yet: draft order creation, filter presets, the settings link.
import { useQuery } from "@apollo/client";
import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { ConditionalOrderFilterProvider } from "../../components/ConditionalFilter/context/provider";
import { createOrderQueryVariables } from "../../components/ConditionalFilter/queryVariables";
import { OrderListDocument } from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { OrderListPage } from "../components/OrderListPage/OrderListPage";
import { DEFAULT_SORT_KEY, getSortQueryVariables, getSortUrlParams } from "../sort";
import { filterUrlEntries, orderListUrl, parseOrderListUrl } from "../urls";

export const OrderList = () => {
  const [searchParams] = useSearchParams();

  return (
    <ConditionalOrderFilterProvider locationSearch={searchParams.toString()}>
      <OrderListContent />
    </ConditionalOrderFilterProvider>
  );
};

const OrderListContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseOrderListUrl(searchParams), [searchParams]);
  const where = useMemo(() => createOrderQueryVariables(params.filters ?? []), [params.filters]);
  const { settings, updateListSettings } = useListSettings("ORDER_LIST");

  useEffect(() => {
    if (params.sort === undefined) {
      navigate(orderListUrl({ ...params, sort: DEFAULT_SORT_KEY, asc: false }), { replace: true });
    }
  }, [navigate, params]);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading } = useQuery(OrderListDocument, {
    variables: {
      ...paginationState,
      search: params.query ?? null,
      sort: getSortQueryVariables(params) ?? null,
      where,
    },
    skip: params.sort === undefined,
  });
  const orders = useMemo(() => data?.orders?.edges.map((edge) => edge.node) ?? [], [data]);
  const paginator = usePaginator({
    pageInfo: data?.orders?.pageInfo,
    paginationState,
    queryString: {
      ...Object.fromEntries(params.filters ? filterUrlEntries(params.filters) : []),
      query: params.query,
      sort: params.sort,
      asc: params.asc,
    },
  });

  // Searching and a new page size start again from the first page.
  const firstPage = { after: undefined, before: undefined };

  return (
    <OrderListPage
      initialSearch={params.query ?? ""}
      onSearchChange={(query) =>
        navigate(orderListUrl({ ...params, ...firstPage, query }), { replace: true })
      }
      orders={orders}
      disabled={loading && !data}
      sort={{ sort: params.sort, asc: params.asc }}
      onSort={(field) => navigate(orderListUrl(getSortUrlParams(params, field)), { replace: true })}
      settings={settings}
      onUpdateListSettings={(key, value) => {
        updateListSettings(key, value);

        // Only a page-size change restarts paging; toggling or resizing a column must not.
        if (key === "rowNumber") {
          navigate(orderListUrl({ ...params, ...firstPage }), { replace: true });
        }
      }}
      hasNextPage={paginator.hasNextPage}
      hasPreviousPage={paginator.hasPreviousPage}
      nextHref={paginator.nextHref}
      prevHref={paginator.prevHref}
    />
  );
};
