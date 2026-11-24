// Adapted from saleor-dashboard: src/structures/views/MenuList/MenuList.tsx (BSD-3-Clause, Copyright
// (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The structures list: search, two sorts and cursor pagination from the URL, a URL without a sort
// redirected to Saleor's default (name, ascending), the create dialog (which jumps to the new
// menu), the single-row delete dialog and the bulk delete dialog. Not yet: filter presets, the
// column picker and extension menu items.
import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate, useSearchParams } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import {
  MenuBulkDeleteDocument,
  MenuCreateDocument,
  MenuDeleteDocument,
  MenuListDocument,
} from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { MenuBulkDeleteDialog } from "../components/MenuBulkDeleteDialog/MenuBulkDeleteDialog";
import { MenuCreateDialog } from "../components/MenuCreateDialog/MenuCreateDialog";
import { MenuDeleteDialog } from "../components/MenuDeleteDialog/MenuDeleteDialog";
import { MenuListPage } from "../components/MenuListPage/MenuListPage";
import { messages } from "../messages";
import { getSortQueryVariables, getSortUrlParams } from "../sort";
import {
  type MenuListUrlDialog,
  type MenuListUrlQueryParams,
  menuListUrl,
  menuPath,
  parseMenuListUrl,
} from "../urls";

export const MenuList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notify = useNotifier();
  const intl = useIntl();
  const params = useMemo(() => parseMenuListUrl(searchParams), [searchParams]);
  const { settings, updateListSettings } = useListSettings("MENU_LIST");

  // Saleor's useSortRedirects: a list URL always names its sort.
  useEffect(() => {
    if (params.sort === undefined) {
      navigate(menuListUrl({ ...params, sort: "name", asc: true }), { replace: true });
    }
  }, [navigate, params]);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading, refetch } = useQuery(MenuListDocument, {
    variables: {
      ...paginationState,
      filter: { search: params.query ?? null },
      sort: getSortQueryVariables(params),
    },
    skip: params.sort === undefined,
  });
  const menus = useMemo(
    () => data?.menus?.edges.map((edge) => edge.node) ?? [],
    [data?.menus?.edges],
  );
  // Selected menu ids, and the grid's own "clear selection" (Saleor's useRowSelection).
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
    pageInfo: data?.menus?.pageInfo,
    paginationState,
    queryString: { query: params.query, sort: params.sort, asc: params.asc },
  });

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL, next to the list state.
  const openModal = (dialog: MenuListUrlDialog, extra?: Partial<MenuListUrlQueryParams>) =>
    navigate(menuListUrl({ ...params, ...extra, action: dialog }));
  const closeModal = () =>
    navigate(menuListUrl({ ...params, action: undefined, id: undefined, ids: undefined }), {
      replace: true,
    });

  const [createMenu, createResult] = useMutation(MenuCreateDocument, {
    onCompleted: (result) => {
      const created = result.menuCreate?.menu;

      if ((result.menuCreate?.errors.length ?? 0) === 0 && created) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.createdStructure),
        });
        navigate(menuPath(encodeURIComponent(created.id)));
      }
    },
  });

  const [deleteMenu, deleteResult] = useMutation(MenuDeleteDocument, {
    onCompleted: (result) => {
      if ((result.menuDelete?.errors.length ?? 0) === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.deletedStructure),
        });
        closeModal();
        void refetch();
      }
    },
  });

  const [bulkDelete, bulkDeleteResult] = useMutation(MenuBulkDeleteDocument, {
    onCompleted: (result) => {
      if ((result.menuBulkDelete?.errors.length ?? 0) === 0) {
        notify({
          status: "success",
          text: intl.formatMessage(messages.menusDeleted),
        });
        closeModal();
        void refetch();
        clearRowSelection();
      }
    },
  });

  // Searching, re-sorting and a new page size all start again from the first page.
  const firstPage = { after: undefined, before: undefined };
  const menuToDelete = menus.find((menu) => menu.id === params.id);

  return (
    <>
      <MenuListPage
        initialSearch={params.query ?? ""}
        onSearchChange={(query) =>
          navigate(menuListUrl({ ...params, ...firstPage, query }), { replace: true })
        }
        onCreateMenu={() => openModal("add")}
        selectedMenuIds={selectedIds}
        onMenusDelete={() => openModal("remove-many", { ids: selectedIds })}
        onDelete={(menuId) => openModal("remove", { id: menuId })}
        onSelectedMenuIdsChange={handleSelectedIdsChange}
        rows={menus}
        disabled={loading && !data}
        sort={{ sort: params.sort, asc: params.asc }}
        onSort={(field) =>
          navigate(menuListUrl(getSortUrlParams(params, field)), { replace: true })
        }
        settings={settings}
        onUpdateListSettings={(key, value) => {
          updateListSettings(key, value);

          // Only a page-size change restarts paging; resizing a column must not.
          if (key === "rowNumber") {
            navigate(menuListUrl({ ...params, ...firstPage }), { replace: true });
          }
        }}
        hasNextPage={paginator.hasNextPage}
        hasPreviousPage={paginator.hasPreviousPage}
        nextHref={paginator.nextHref}
        prevHref={paginator.prevHref}
      />
      <MenuCreateDialog
        open={params.action === "add"}
        confirmButtonState={getMutationStatus({
          ...createResult,
          errors: createResult.data?.menuCreate?.errors,
        })}
        errors={createResult.data?.menuCreate?.errors ?? []}
        onClose={closeModal}
        onConfirm={async (formData) => {
          const result = await createMenu({ variables: { input: { name: formData.name } } });

          return result.data?.menuCreate?.errors ?? [];
        }}
      />
      <MenuDeleteDialog
        open={params.action === "remove" && !!params.id}
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.menuDelete?.errors,
        })}
        onClose={closeModal}
        onConfirm={() => {
          if (params.id) {
            void deleteMenu({ variables: { id: params.id } });
          }
        }}
        subtitle={
          <FormattedMessage
            id="bj1U23"
            defaultMessage="Are you sure you want to delete {menuName}?"
            values={{
              menuName: <strong>{menuToDelete?.name ?? "..."}</strong>,
            }}
          />
        }
      />
      <MenuBulkDeleteDialog
        open={params.action === "remove-many" && selectedIds.length > 0}
        count={selectedIds.length}
        confirmButtonState={getMutationStatus({
          ...bulkDeleteResult,
          errors: bulkDeleteResult.data?.menuBulkDelete?.errors,
        })}
        onClose={closeModal}
        onConfirm={() => void bulkDelete({ variables: { ids: selectedIds } })}
      />
    </>
  );
};
