// Adapted from saleor-dashboard: src/customers/views/CustomerList/CustomerList.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The customer list with search, sort and cursor pagination, all from the URL as Saleor. The
// order count is requested only when the staff user has MANAGE_ORDERS (Saleor's
// PERMISSION_MANAGE_ORDERS variable). Selected rows can be deleted together: the dialog lives in
// the URL (`action=remove`), confirming deletes them, toasts "Customers deleted", clears the
// selection and refetches; refused ones (staff accounts) are reported. Left out: the conditional
// filters and customer-type tabs (PLAN M7 decision 3).
import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useSearchParams } from "react-router";

import { useUser } from "../../auth/AuthProvider";
import { hasPermission } from "../../auth/misc";
import { getMutationStatus } from "../../categories/mutationStatus";
import { BulkRemoveCustomersDocument, ListCustomersDocument } from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { getAccountErrorMessage } from "../../utils/errors";
import { CustomerBulkDeleteDialog } from "../components/CustomerBulkDeleteDialog/CustomerBulkDeleteDialog";
import { CustomerListPage } from "../components/CustomerListPage/CustomerListPage";
import { getSortQueryVariables, getSortUrlParams } from "../sort";
import { customerAddUrl, customerListUrl, parseCustomerListUrl } from "../urls";

export const CustomerList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseCustomerListUrl(searchParams), [searchParams]);
  const { user } = useUser();
  const canReadOrders = !!user && hasPermission("MANAGE_ORDERS", user);
  const canEdit = !!user && hasPermission("MANAGE_USERS", user);
  const intl = useIntl();
  const notify = useNotifier();
  const { settings, updateListSettings } = useListSettings("CUSTOMER_LIST");

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading, refetch } = useQuery(ListCustomersDocument, {
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

  // Selected customer ids, and the grid's own "clear selection" (Saleor's useRowSelection).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const clearGridSelection = useRef<() => void>(() => {});
  const handleSelectedIdsChange = useCallback((ids: string[], clearSelection: () => void) => {
    clearGridSelection.current = clearSelection;
    setSelectedIds((current) => (current.join() === ids.join() ? current : ids));
  }, []);
  const clearRowSelection = useCallback(() => {
    clearGridSelection.current();
    setSelectedIds([]);
  }, []);

  const closeModal = () =>
    navigate(customerListUrl({ ...params, action: undefined }), { replace: true });

  const [bulkRemoveCustomers, bulkRemoveCustomersOpts] = useMutation(BulkRemoveCustomersDocument, {
    onCompleted: (result) => {
      const errors = result.customerBulkDelete?.errors ?? [];

      void refetch();
      clearRowSelection();
      closeModal();
      if (errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage({ id: "xgPXGD", defaultMessage: "Customers deleted" }),
        });

        return;
      }
      // Saleor shows "Unknown error"; ours names why (e.g. a staff account can't be deleted).
      for (const error of errors) {
        notify({ status: "error", text: getAccountErrorMessage(error, intl) });
      }
    },
  });

  // Searching and a new page size start again from the first page.
  const firstPage = { after: undefined, before: undefined };

  return (
    <>
      <CustomerListPage
        canEdit={canEdit}
        selectedCustomerIds={selectedIds}
        onSelectedCustomerIdsChange={handleSelectedIdsChange}
        onAdd={() => navigate(customerAddUrl())}
        onCustomersDelete={() => navigate(customerListUrl({ ...params, action: "remove" }))}
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
      <CustomerBulkDeleteDialog
        confirmButtonState={getMutationStatus({
          ...bulkRemoveCustomersOpts,
          errors: bulkRemoveCustomersOpts.data?.customerBulkDelete?.errors,
        })}
        count={selectedIds.length}
        onClose={closeModal}
        onConfirm={() => void bulkRemoveCustomers({ variables: { ids: selectedIds } })}
        open={params.action === "remove" && selectedIds.length > 0 && canEdit}
      />
    </>
  );
};
