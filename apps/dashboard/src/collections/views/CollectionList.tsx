// Adapted from saleor-dashboard: src/collections/views/CollectionList/CollectionList.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The collection list with search, the publication filter, sort and cursor pagination, all from the
// URL as Saleor; a URL without a sort is redirected to Saleor's default (name, ascending). The
// URL's `action=create` opens Saleor's CreateCollectionDialog; on success a toast and a jump to the
// new collection (its page is M15.5b). Selected rows open Saleor's bulk delete dialog on
// `action=remove`; confirming deletes them, clears the selection, toasts and refetches. Not yet:
// filter presets, the channel filter and the other bulk actions.
import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useSearchParams } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import {
  CollectionBulkDeleteDocument,
  type CollectionErrorFragment,
  CollectionListDocument,
  CreateCollectionDocument,
} from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { CollectionBulkDeleteDialog } from "../components/CollectionBulkDeleteDialog/CollectionBulkDeleteDialog";
import { CollectionListPage } from "../components/CollectionListPage/CollectionListPage";
import { CreateCollectionDialog } from "../components/CreateCollectionDialog/CreateCollectionDialog";
import { messages as createCollectionMessages } from "../components/CreateCollectionDialog/messages";
import { getSortQueryVariables, getSortUrlParams } from "../sort";
import {
  type CollectionListUrlDialog,
  type CollectionListUrlQueryParams,
  collectionListUrl,
  collectionUrl,
  parseCollectionListUrl,
} from "../urls";

export const CollectionList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notify = useNotifier();
  const intl = useIntl();
  const params = useMemo(() => parseCollectionListUrl(searchParams), [searchParams]);
  const { settings, updateListSettings } = useListSettings("COLLECTION_LIST");

  // Saleor's useSortRedirects: a list URL always names its sort.
  useEffect(() => {
    if (params.sort === undefined) {
      navigate(collectionListUrl({ ...params, sort: "name", asc: true }), { replace: true });
    }
  }, [navigate, params]);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading, refetch } = useQuery(CollectionListDocument, {
    variables: {
      ...paginationState,
      filter: {
        search: params.query ?? null,
        published:
          params.status === "published"
            ? "PUBLISHED"
            : params.status === "hidden"
              ? "HIDDEN"
              : null,
      },
      sort: getSortQueryVariables(params),
    },
    skip: params.sort === undefined,
  });
  const collections = useMemo(
    () => data?.collections?.edges.map((edge) => edge.node) ?? [],
    [data?.collections?.edges],
  );
  // Selected collection ids, and the grid's own "clear selection" (Saleor's useRowSelection).
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
    pageInfo: data?.collections?.pageInfo,
    paginationState,
    queryString: {
      query: params.query,
      status: params.status,
      sort: params.sort,
      asc: params.asc,
    },
  });

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL, next to the list state.
  const openModal = (
    dialog: CollectionListUrlDialog,
    extra?: Partial<CollectionListUrlQueryParams>,
  ) => navigate(collectionListUrl({ ...params, ...extra, action: dialog }));
  const closeModal = () =>
    navigate(collectionListUrl({ ...params, action: undefined, ids: undefined }), {
      replace: true,
    });

  const [createCollection, createCollectionOpts] = useMutation(CreateCollectionDocument, {
    onCompleted: (result) => {
      if ((result.collectionCreate.errors.length ?? 0) > 0) {
        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(createCollectionMessages.created),
      });
      closeModal();
      navigate(collectionUrl(result.collectionCreate.collection?.id ?? ""));
    },
  });

  const [collectionBulkDelete, collectionBulkDeleteOpts] = useMutation(
    CollectionBulkDeleteDocument,
    {
      onCompleted: (result) => {
        if ((result.collectionBulkDelete?.errors.length ?? 0) > 0) {
          return;
        }

        closeModal();
        notify({
          status: "success",
          text: intl.formatMessage({
            id: "tV5QlB",
            defaultMessage: "Collections deleted",
          }),
        });
        void refetch();
        clearRowSelection();
      },
    },
  );

  // Searching, re-sorting, a new status and a new page size all start again from the first page.
  const firstPage = { after: undefined, before: undefined };

  return (
    <>
      <CollectionListPage
        initialSearch={params.query ?? ""}
        onSearchChange={(query) =>
          navigate(collectionListUrl({ ...params, ...firstPage, query }), { replace: true })
        }
        status={params.status}
        onStatusChange={(status) =>
          navigate(collectionListUrl({ ...params, ...firstPage, status }), { replace: true })
        }
        onCreateCollection={() => openModal("create")}
        selectedCollectionIds={selectedIds}
        onCollectionsDelete={() => openModal("remove", { ids: selectedIds })}
        onSelectedCollectionIdsChange={handleSelectedIdsChange}
        rows={collections}
        disabled={loading && !data}
        sort={{ sort: params.sort, asc: params.asc }}
        onSort={(field) =>
          navigate(collectionListUrl(getSortUrlParams(params, field)), { replace: true })
        }
        settings={settings}
        onUpdateListSettings={(key, value) => {
          updateListSettings(key, value);

          // Only a page-size change restarts paging; toggling or resizing a column must not.
          if (key === "rowNumber") {
            navigate(collectionListUrl({ ...params, ...firstPage }), { replace: true });
          }
        }}
        hasNextPage={paginator.hasNextPage}
        hasPreviousPage={paginator.hasPreviousPage}
        nextHref={paginator.nextHref}
        prevHref={paginator.prevHref}
      />
      <CollectionBulkDeleteDialog
        open={params.action === "remove" && selectedIds.length > 0}
        count={selectedIds.length}
        confirmButtonState={getMutationStatus({
          ...collectionBulkDeleteOpts,
          errors: collectionBulkDeleteOpts.data?.collectionBulkDelete?.errors,
        })}
        onClose={closeModal}
        onConfirm={() => void collectionBulkDelete({ variables: { ids: selectedIds } })}
      />
      <CreateCollectionDialog
        open={params.action === "create"}
        onClose={closeModal}
        confirmButtonState={getMutationStatus({
          ...createCollectionOpts,
          errors: createCollectionOpts.data?.collectionCreate.errors,
        })}
        disabled={createCollectionOpts.loading}
        errors={createCollectionOpts.data?.collectionCreate.errors ?? []}
        onSubmit={async ({ name }) => {
          const result = await createCollection({ variables: { input: { name } } });

          return (result.data?.collectionCreate.errors ?? []) as CollectionErrorFragment[];
        }}
      />
    </>
  );
};
