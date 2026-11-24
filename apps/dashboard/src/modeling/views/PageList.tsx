// Adapted from saleor-dashboard: src/modeling/views/PageList/PageList.tsx (BSD-3-Clause, Copyright
// (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The model list with search, sort and cursor pagination, all from the URL as Saleor; a URL without
// a sort is redirected to Saleor's default (title, ascending). "Create model" opens the new page's
// screen (`/models/add`) directly — no page-type picker, as the brief's simplification. Selected
// rows open Saleor's bulk delete dialog on `action=remove`; confirming deletes them, clears the
// selection, toasts and refetches. Not yet: the page-type tabs and their counts, the bulk
// publish/unpublish actions (no API), extension menu items and navigation pins.
import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useSearchParams } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import { PageBulkDeleteDocument, PageListDocument } from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { PageBulkDeleteDialog } from "../components/PageBulkDeleteDialog/PageBulkDeleteDialog";
import { PageListPage } from "../components/PageListPage/PageListPage";
import { getSortQueryVariables, getSortUrlParams } from "../sort";
import {
  type PageListUrlDialog,
  type PageListUrlQueryParams,
  pageCreatePath,
  pageListUrl,
  parsePageListUrl,
} from "../urls";

export const PageList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notify = useNotifier();
  const intl = useIntl();
  const params = useMemo(() => parsePageListUrl(searchParams), [searchParams]);
  const { settings, updateListSettings } = useListSettings("PAGES_LIST");

  // Saleor's useSortRedirects: a list URL always names its sort.
  useEffect(() => {
    if (params.sort === undefined) {
      navigate(pageListUrl({ ...params, sort: "title", asc: true }), { replace: true });
    }
  }, [navigate, params]);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading, refetch } = useQuery(PageListDocument, {
    variables: {
      ...paginationState,
      filter: { search: params.query ?? null },
      sort: getSortQueryVariables(params),
    },
    skip: params.sort === undefined,
  });
  const pages = useMemo(
    () => data?.pages?.edges.map((edge) => edge.node) ?? [],
    [data?.pages?.edges],
  );
  // Selected page ids, and the grid's own "clear selection" (Saleor's useRowSelection).
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
  const paginator = usePaginator({
    pageInfo: data?.pages?.pageInfo,
    paginationState,
    queryString: { query: params.query, sort: params.sort, asc: params.asc },
  });

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL, next to the list state.
  const openModal = (dialog: PageListUrlDialog, extra?: Partial<PageListUrlQueryParams>) =>
    navigate(pageListUrl({ ...params, ...extra, action: dialog }));
  const closeModal = () =>
    navigate(pageListUrl({ ...params, action: undefined, ids: undefined }), {
      replace: true,
    });

  const [pageBulkDelete, pageBulkDeleteOpts] = useMutation(PageBulkDeleteDocument, {
    onCompleted: (result) => {
      if ((result.pageBulkDelete?.errors.length ?? 0) > 0) {
        return;
      }

      closeModal();
      notify({
        status: "success",
        text: intl.formatMessage({
          id: "vwA9Fq",
          defaultMessage: "Selected models were deleted.",
          description: "notification",
        }),
      });
      void refetch();
      clearRowSelection();
    },
  });

  // Searching, re-sorting and a new page size all start again from the first page.
  const firstPage = { after: undefined, before: undefined };

  return (
    <>
      <PageListPage
        initialSearch={params.query ?? ""}
        onSearchChange={(query) =>
          navigate(pageListUrl({ ...params, ...firstPage, query }), { replace: true })
        }
        onPageCreate={() => navigate(pageCreatePath)}
        selectedPageIds={selectedIds}
        onPagesDelete={() => openModal("remove", { ids: selectedIds })}
        onSelectedPageIdsChange={handleSelectedIdsChange}
        rows={pages}
        disabled={loading && !data}
        sort={{ sort: params.sort, asc: params.asc }}
        onSort={(field) =>
          navigate(pageListUrl(getSortUrlParams(params, field)), { replace: true })
        }
        settings={settings}
        onUpdateListSettings={(key, value) => {
          updateListSettings(key, value);

          // Only a page-size change restarts paging; resizing a column must not.
          if (key === "rowNumber") {
            navigate(pageListUrl({ ...params, ...firstPage }), { replace: true });
          }
        }}
        hasNextPage={paginator.hasNextPage}
        hasPreviousPage={paginator.hasPreviousPage}
        nextHref={paginator.nextHref}
        prevHref={paginator.prevHref}
      />
      <PageBulkDeleteDialog
        open={params.action === "remove" && selectedIds.length > 0}
        count={selectedIds.length}
        confirmButtonState={getMutationStatus({
          ...pageBulkDeleteOpts,
          errors: pageBulkDeleteOpts.data?.pageBulkDelete?.errors,
        })}
        onClose={closeModal}
        onConfirm={() => void pageBulkDelete({ variables: { ids: selectedIds } })}
      />
    </>
  );
};
