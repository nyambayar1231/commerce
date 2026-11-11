// Adapted from saleor-dashboard: src/products/views/ProductList/ProductList.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product list with filters, search, sort and cursor pagination, all from the URL as Saleor;
// a URL without a sort is redirected to Saleor's default (name, ascending). The conditional
// filters in the URL become the query's `where`; the filter panel edits a copy and applies it back
// to the URL. The URL's `action=create-product` opens Saleor's CreateProductDialog (name and
// category only); on success a toast and a jump to the new product. Selected rows open Saleor's
// bulk delete dialog on `action=delete`; confirming deletes them, clears the selection, toasts and
// refetches the list. Not yet: the other bulk actions, export, filter presets, tiles view.
import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useSearchParams } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import { ConditionalProductFilterProvider } from "../../components/ConditionalFilter/context/provider";
import { createProductQueryVariables } from "../../components/ConditionalFilter/queryVariables";
import {
  ProductBulkDeleteDocument,
  ProductCreateDocument,
  type ProductErrorFragment,
  ProductListDocument,
} from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { getProductErrorMessage } from "../../utils/errors";
import { CreateProductDialog } from "../components/CreateProductDialog/CreateProductDialog";
import { messages as createProductMessages } from "../components/CreateProductDialog/messages";
import { ProductBulkDeleteDialog } from "../components/ProductBulkDeleteDialog/ProductBulkDeleteDialog";
import { messages as productListMessages } from "../components/ProductListPage/messages";
import { ProductListPage } from "../components/ProductListPage/ProductListPage";
import { getSortQueryVariables, getSortUrlParams } from "../sort";
import {
  filterUrlEntries,
  type ProductListUrlDialog,
  parseProductListUrl,
  productListUrl,
  productUrl,
} from "../urls";

export const ProductList = () => {
  const [searchParams] = useSearchParams();

  return (
    <ConditionalProductFilterProvider locationSearch={searchParams.toString()}>
      <ProductListContent />
    </ConditionalProductFilterProvider>
  );
};

const ProductListContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intl = useIntl();
  const notify = useNotifier();
  const params = useMemo(() => parseProductListUrl(searchParams), [searchParams]);
  const where = useMemo(() => createProductQueryVariables(params.filters ?? []), [params.filters]);
  const { settings, updateListSettings } = useListSettings("PRODUCT_LIST");

  // Saleor's useSortRedirects: a list URL always names its sort.
  useEffect(() => {
    if (params.sort === undefined) {
      navigate(productListUrl({ ...params, sort: "name", asc: true }), { replace: true });
    }
  }, [navigate, params]);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading, refetch } = useQuery(ProductListDocument, {
    variables: {
      ...paginationState,
      search: params.query ?? null,
      sort: getSortQueryVariables(params) ?? null,
      where,
    },
    skip: params.sort === undefined,
  });
  const products = useMemo(
    () => data?.products?.edges.map((edge) => edge.node) ?? [],
    [data?.products?.edges],
  );
  // Selected product ids, and the grid's own "clear selection" (Saleor's useRowSelection).
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
    pageInfo: data?.products?.pageInfo,
    paginationState,
    // Filters are indexed entries, so they are spread in by their query-string keys and the
    // previous/next links keep the filtered list.
    queryString: {
      ...Object.fromEntries(params.filters ? filterUrlEntries(params.filters) : []),
      query: params.query,
      sort: params.sort,
      asc: params.asc,
    },
  });

  // Searching, re-sorting and a new page size all start again from the first page.
  const firstPage = { after: undefined, before: undefined };

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = (dialog: ProductListUrlDialog) =>
    navigate(productListUrl({ ...params, action: dialog }));
  const closeModal = () =>
    navigate(productListUrl({ ...params, action: undefined }), { replace: true });

  const [createProduct, createProductOpts] = useMutation(ProductCreateDocument, {
    onCompleted: (result) => {
      const errors = result.productCreate.errors;

      if (errors.length > 0) {
        // `name` and `category` stay on their inputs; anything else is a notification.
        for (const error of errors.filter(
          (error) => error.field !== "name" && error.field !== "category",
        )) {
          notify({
            status: "error",
            text: getProductErrorMessage(error, intl),
          });
        }

        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(createProductMessages.created),
      });
      closeModal();
      navigate(productUrl(result.productCreate.product?.id ?? ""));
    },
  });

  const [productBulkDelete, productBulkDeleteOpts] = useMutation(ProductBulkDeleteDocument, {
    onCompleted: (result) => {
      if ((result.productBulkDelete?.errors.length ?? 0) > 0) {
        return;
      }

      closeModal();
      notify({
        status: "success",
        text: intl.formatMessage(productListMessages.productsDeleted),
      });
      void refetch();
      clearRowSelection();
    },
  });

  const handleSubmitBulkDelete = () => {
    void productBulkDelete({ variables: { ids: selectedIds } });
  };

  return (
    <>
      <ProductListPage
        initialSearch={params.query ?? ""}
        onSearchChange={(query) =>
          navigate(productListUrl({ ...params, ...firstPage, query }), { replace: true })
        }
        onAdd={() => openModal("create-product")}
        selectedProductIds={selectedIds}
        onProductsDelete={() => openModal("delete")}
        onSelectedProductIdsChange={handleSelectedIdsChange}
        rows={products}
        disabled={loading && !data}
        sort={{ sort: params.sort, asc: params.asc }}
        onSort={(field) =>
          navigate(productListUrl(getSortUrlParams(params, field)), { replace: true })
        }
        settings={settings}
        onUpdateListSettings={(key, value) => {
          updateListSettings(key, value);

          // Only a page-size change restarts paging; toggling or resizing a column must not.
          if (key === "rowNumber") {
            navigate(productListUrl({ ...params, ...firstPage }), { replace: true });
          }
        }}
        hasNextPage={paginator.hasNextPage}
        hasPreviousPage={paginator.hasPreviousPage}
        nextHref={paginator.nextHref}
        prevHref={paginator.prevHref}
      />
      <ProductBulkDeleteDialog
        open={params.action === "delete" && selectedIds.length > 0}
        count={selectedIds.length}
        confirmButtonState={getMutationStatus({
          ...productBulkDeleteOpts,
          errors: productBulkDeleteOpts.data?.productBulkDelete?.errors,
        })}
        onClose={closeModal}
        onConfirm={handleSubmitBulkDelete}
      />
      <CreateProductDialog
        open={params.action === "create-product"}
        onClose={closeModal}
        confirmButtonState={getMutationStatus({
          ...createProductOpts,
          errors: createProductOpts.data?.productCreate.errors,
        })}
        disabled={createProductOpts.loading}
        errors={createProductOpts.data?.productCreate.errors ?? []}
        onSubmit={async ({ name, category }) => {
          const result = await createProduct({
            variables: {
              input: {
                name,
                // No `isPublished`: a product without variants can't be published.
                category,
              },
            },
          });

          return (result.data?.productCreate.errors ?? []) as ProductErrorFragment[];
        }}
      />
    </>
  );
};
