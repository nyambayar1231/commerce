// Adapted from saleor-dashboard: src/customers/views/CustomerList/CustomerList.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The customer list with search, sort and cursor pagination, all from the URL as Saleor. The
// order count is requested only when the staff user has MANAGE_ORDERS (Saleor's
// PERMISSION_MANAGE_ORDERS variable). Not yet: bulk delete and its dialog (M7.5). Left out: the
// conditional filters and customer-type tabs (PLAN M7 decision 3).
import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { useUser } from "../../auth/AuthProvider";
import { hasPermission } from "../../auth/misc";
import { ListCustomersDocument } from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { CustomerListPage } from "../components/CustomerListPage/CustomerListPage";
import { getSortQueryVariables, getSortUrlParams } from "../sort";
import { customerListUrl, parseCustomerListUrl } from "../urls";

export const CustomerList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseCustomerListUrl(searchParams), [searchParams]);
  const { user } = useUser();
  const canReadOrders = !!user && hasPermission("MANAGE_ORDERS", user);
  const { settings, updateListSettings } = useListSettings("CUSTOMER_LIST");

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading } = useQuery(ListCustomersDocument, {
    variables: {
      ...paginationState,
      search: params.query ?? null,
      sort: getSortQueryVariables(params) ?? null,
      PERMISSION_MANAGE_ORDERS: canReadOrders,
    },
  });
  const customers = useMemo(() => data?.customers?.edges.map((edge) => edge.node) ?? [], [data]);
  const paginator = usePaginator({
    pageInfo: data?.customers?.pageInfo,
    paginationState,
    queryString: { query: params.query, sort: params.sort, asc: params.asc },
  });

  // Searching and a new page size start again from the first page.
  const firstPage = { after: undefined, before: undefined };

  return (
    <CustomerListPage
      initialSearch={params.query ?? ""}
      onSearchChange={(query) =>
        navigate(customerListUrl({ ...params, ...firstPage, query }), { replace: true })
      }
      customers={customers}
      includeOrders={canReadOrders}
      disabled={loading && !data}
      sort={{ sort: params.sort, asc: params.asc }}
      onSort={(field) =>
        navigate(customerListUrl(getSortUrlParams(params, field)), { replace: true })
      }
      settings={settings}
      onUpdateListSettings={(key, value) => {
        updateListSettings(key, value);

        // Only a page-size change restarts paging; toggling or resizing a column must not.
        if (key === "rowNumber") {
          navigate(customerListUrl({ ...params, ...firstPage }), { replace: true });
        }
      }}
      hasNextPage={paginator.hasNextPage}
      hasPreviousPage={paginator.hasPreviousPage}
      nextHref={paginator.nextHref}
      prevHref={paginator.prevHref}
    />
  );
};
