// Adapted from saleor-dashboard: src/categories/views/CategoryList/CategoryList.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Top-level categories with search, sort and cursor pagination, all from the URL as Saleor; a URL
// without a sort is redirected to Saleor's default (name, ascending). The URL's `action=create`
// opens Saleor's CreateCategoryDialog; on success a toast and a jump to the new category.
// Not yet: tree rows and bulk delete (M2.1.8b/c), filter presets.
import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useSearchParams } from "react-router";

import {
  CategoryCreateDocument,
  type ProductErrorFragment,
  RootCategoriesDocument,
} from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { createPaginationState, usePaginator } from "../../hooks/usePaginator";
import { CategoryListPage } from "../components/CategoryListPage/CategoryListPage";
import { CreateCategoryDialog } from "../components/CreateCategoryDialog/CreateCategoryDialog";
import { messages as createCategoryMessages } from "../components/CreateCategoryDialog/messages";
import { getMutationStatus } from "../mutationStatus";
import { getSortQueryVariables, getSortUrlParams } from "../sort";
import {
  type CategoryListUrlDialog,
  categoryListUrl,
  categoryUrl,
  parseCategoryListUrl,
} from "../urls";

export const CategoryList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notify = useNotifier();
  const intl = useIntl();
  const params = useMemo(() => parseCategoryListUrl(searchParams), [searchParams]);
  const { settings, updateListSettings } = useListSettings("CATEGORY_LIST");

  // Saleor's useSortRedirects: a list URL always names its sort.
  useEffect(() => {
    if (params.sort === undefined) {
      navigate(categoryListUrl({ ...params, sort: "name", asc: true }), { replace: true });
    }
  }, [navigate, params]);

  const paginationState = createPaginationState(settings.rowNumber, params);
  const { data, loading } = useQuery(RootCategoriesDocument, {
    variables: {
      ...paginationState,
      filter: params.query ? { search: params.query } : null,
      sort: getSortQueryVariables(params),
    },
    skip: params.sort === undefined,
  });
  const rows = data?.categories?.edges.map((edge) => edge.node) ?? [];
  const paginator = usePaginator({
    pageInfo: data?.categories?.pageInfo,
    paginationState,
    queryString: { query: params.query, sort: params.sort, asc: params.asc },
  });

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL, next to the list state.
  const openModal = (dialog: CategoryListUrlDialog) =>
    navigate(categoryListUrl({ ...params, action: dialog }));
  const closeModal = () =>
    navigate(categoryListUrl({ ...params, action: undefined }), { replace: true });

  const [createCategory, createCategoryOpts] = useMutation(CategoryCreateDocument, {
    onCompleted: (result) => {
      if ((result.categoryCreate.errors.length ?? 0) > 0) {
        return;
      }

      notify({
        status: "success",
        text: intl.formatMessage(createCategoryMessages.created),
      });
      closeModal();
      navigate(categoryUrl(result.categoryCreate.category?.id ?? ""));
    },
  });

  // Searching, re-sorting and a new page size all start again from the first page.
  const firstPage = { after: undefined, before: undefined };

  return (
    <>
      <CategoryListPage
        initialSearch={params.query ?? ""}
        onSearchChange={(query) =>
          navigate(categoryListUrl({ ...params, ...firstPage, query }), { replace: true })
        }
        onCreateCategory={() => openModal("create")}
        rows={rows}
        disabled={loading && !data}
        sort={{ sort: params.sort, asc: params.asc }}
        onSort={(field) =>
          navigate(categoryListUrl(getSortUrlParams(params, field)), { replace: true })
        }
        settings={settings}
        onUpdateListSettings={(key, value) => {
          updateListSettings(key, value);
          navigate(categoryListUrl({ ...params, ...firstPage }), { replace: true });
        }}
        hasNextPage={paginator.hasNextPage}
        hasPreviousPage={paginator.hasPreviousPage}
        nextHref={paginator.nextHref}
        prevHref={paginator.prevHref}
      />
      <CreateCategoryDialog
        open={params.action === "create"}
        onClose={closeModal}
        confirmButtonState={getMutationStatus({
          ...createCategoryOpts,
          errors: createCategoryOpts.data?.categoryCreate.errors,
        })}
        disabled={createCategoryOpts.loading}
        errors={createCategoryOpts.data?.categoryCreate.errors ?? []}
        onSubmit={async ({ name, description }) => {
          const result = await createCategory({
            variables: {
              parent: null,
              input: {
                name,
                // Saleor's getParsedDataForJsonStringField: JSON only when there are blocks.
                ...(description?.blocks.length ? { description: JSON.stringify(description) } : {}),
              },
            },
          });

          return (result.data?.categoryCreate.errors ?? []) as ProductErrorFragment[];
        }}
      />
    </>
  );
};
