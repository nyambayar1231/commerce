// Adapted from saleor-dashboard: src/orders/views/OrderDraftList/OrderDraftList.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The drafts list (PLAN M13.5) with search, sort and cursor pagination from the URL, as our order
// list; a URL without a sort goes to number descending. "Create order" makes an empty draft and
// opens it. Left out: filters, presets and bulk delete.
import { useQuery } from "@apollo/client";
import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { OrderDraftListDocument } from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { OrderDraftListPage } from "../components/OrderDraftListPage/OrderDraftListPage";
import { DEFAULT_DRAFT_SORT_KEY, getDraftSortQueryVariables, getDraftSortUrlParams } from "../sort";
import { orderDraftListUrl, parseOrderDraftListUrl } from "../urls";
import { useCreateDraftOrder } from "../useCreateDraftOrder";

export const OrderDraftList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseOrderDraftListUrl(searchParams), [searchParams]);
  const { settings, updateListSettings } = useListSettings("ORDER_DRAFT_LIST");
  const { createDraftOrder, creating } = useCreateDraftOrder();

  useEffect(() => {
    if (params.sort === undefined) {
      navigate(orderDraftListUrl({ ...params, sort: DEFAULT_DRAFT_SORT_KEY, asc: false }), {
        replace: true,
      });
    }
  }, [navigate, params]);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading } = useQuery(OrderDraftListDocument, {
    variables: {
      ...paginationState,
      search: params.query ?? null,
      sort: getDraftSortQueryVariables(params) ?? null,
    },
    skip: params.sort === undefined,
    fetchPolicy: "cache-and-network",
  });
  const orders = useMemo(() => data?.draftOrders?.edges.map((edge) => edge.node) ?? [], [data]);
  const paginator = usePaginator({
    pageInfo: data?.draftOrders?.pageInfo,
    paginationState,
    queryString: { query: params.query, sort: params.sort, asc: params.asc },
  });
  const firstPage = { after: undefined, before: undefined };

  return (
    <OrderDraftListPage
      initialSearch={params.query ?? ""}
      onSearchChange={(query) =>
        navigate(orderDraftListUrl({ ...params, ...firstPage, query }), { replace: true })
      }
      onAdd={createDraftOrder}
      creating={creating}
      orders={orders}
      disabled={loading && !data}
      sort={{ sort: params.sort, asc: params.asc }}
      onSort={(field) =>
        navigate(orderDraftListUrl(getDraftSortUrlParams(params, field)), { replace: true })
      }
      settings={settings}
      onUpdateListSettings={(key, value) => {
        updateListSettings(key, value);

        if (key === "rowNumber") {
          navigate(orderDraftListUrl({ ...params, ...firstPage }), { replace: true });
        }
      }}
      hasNextPage={paginator.hasNextPage}
      hasPreviousPage={paginator.hasPreviousPage}
      nextHref={paginator.nextHref}
      prevHref={paginator.prevHref}
    />
  );
};
