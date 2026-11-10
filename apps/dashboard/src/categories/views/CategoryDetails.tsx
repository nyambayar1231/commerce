// Adapted from saleor-dashboard: src/categories/views/CategoryDetails.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The page's container: loads the category, saves it, deletes it, and creates subcategories through
// Saleor's dialog (URL `action=create` / `action=delete`, as Saleor). The Subcategories card pages
// through the children (page state kept locally, rows per page from the list settings, as
// Saleor's) and bulk-deletes selected ones (`action=delete-categories`). The Products card queries
// its own connection (see CategoryProducts). Not yet: background image, metadata (see
// CategoryUpdatePage).
import { useMutation, useQuery } from "@apollo/client";
import { useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { useExitFormDialog } from "../../components/Form/useExitFormDialog";
import {
  CategoryBulkDeleteDocument,
  CategoryCreateDocument,
  CategoryDeleteDocument,
  CategoryDetailsDocument,
  CategoryUpdateDocument,
  type ProductErrorFragment,
} from "../../graphql/types.generated";
import useListSettings from "../../hooks/useListSettings";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { type PaginationState, usePaginator } from "../../hooks/usePaginator";
import { NotFound } from "../../NotFound";
import { CategoryBulkDeleteDialog } from "../components/CategoryBulkDeleteDialog/CategoryBulkDeleteDialog";
import { CategoryDeleteDialog } from "../components/CategoryDeleteDialog/CategoryDeleteDialog";
import { CategoryUpdatePage } from "../components/CategoryUpdatePage/CategoryUpdatePage";
import type { CategoryUpdateData } from "../components/CategoryUpdatePage/form";
import { CreateCategoryDialog } from "../components/CreateCategoryDialog/CreateCategoryDialog";
import { messages as createCategoryMessages } from "../components/CreateCategoryDialog/messages";
import { getMutationStatus } from "../mutationStatus";
import { type CategoryUrlDialog, categoryListUrl, categoryUrl } from "../urls";

export const CategoryDetails = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action") as CategoryUrlDialog | null;
  const navigate = useNavigate();
  const notify = useNotifier();
  const intl = useIntl();
  const { resetFormsState } = useExitFormDialog();

  const { settings, updateListSettings } = useListSettings("CATEGORY_LIST");
  // Saleor's useLocalPaginationState: the card's page lives in state, not in the URL.
  const [childrenPage, setChildrenPage] = useState<PaginationState>({});
  const [childrenPageFor, setChildrenPageFor] = useState(id);

  // Another category: start its card on the first page again.
  if (childrenPageFor !== id) {
    setChildrenPageFor(id);
    setChildrenPage({});
  }
  const childrenPagination: PaginationState =
    childrenPage.before !== undefined
      ? { before: childrenPage.before, last: settings.rowNumber }
      : { after: childrenPage.after, first: settings.rowNumber };

  const { data, loading, refetch } = useQuery(CategoryDetailsDocument, {
    variables: {
      id,
      childrenFirst: childrenPagination.first,
      childrenAfter: childrenPagination.after,
      childrenLast: childrenPagination.last,
      childrenBefore: childrenPagination.before,
    },
  });
  const category = data?.category;
  const children = category?.children;
  const childrenPaginator = usePaginator({
    pageInfo: children?.pageInfo,
    paginationState: childrenPagination,
    queryString: {},
  });

  // Selected subcategories, and the grid's own "clear selection".
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const clearGridSelection = useRef<() => void>(() => {});
  const handleSelectedChildIdsChange = useCallback((ids: string[], clearSelection: () => void) => {
    clearGridSelection.current = clearSelection;
    setSelectedChildIds((current) => (current.join() === ids.join() ? current : ids));
  }, []);

  // Saleor's createDialogActionHandlers: the open dialog lives in the URL.
  const openModal = (dialog: CategoryUrlDialog) => navigate(categoryUrl(id, { action: dialog }));
  const closeModal = () => navigate(categoryUrl(id), { replace: true });

  const [updateCategory, updateResult] = useMutation(CategoryUpdateDocument, {
    onCompleted: (result) => {
      if (result.categoryUpdate.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage({ id: "H4Lcuk", defaultMessage: "Category updated" }),
        });
      }
    },
  });

  const [deleteCategory, deleteResult] = useMutation(CategoryDeleteDocument, {
    onCompleted: (result) => {
      if (result.categoryDelete.errors.length === 0) {
        notify({
          status: "success",
          text: intl.formatMessage({ id: "HvJPcU", defaultMessage: "Category deleted" }),
        });
        // The category is gone: unsaved edits to it must not block leaving.
        resetFormsState();
        navigate(categoryListUrl());
      }
    },
  });

  const [createCategory, createCategoryOpts] = useMutation(CategoryCreateDocument, {
    onCompleted: (result) => {
      if (result.categoryCreate.errors.length > 0) {
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

  const [bulkDeleteChildren, bulkDeleteResult] = useMutation(CategoryBulkDeleteDocument, {
    onCompleted: (result) => {
      if ((result.categoryBulkDelete?.errors.length ?? 0) > 0) {
        return;
      }

      clearGridSelection.current();
      setSelectedChildIds([]);
      closeModal();
      // Back to the card's first page, fetched fresh: a plain refetch() would re-run the page that
      // was showing, and the first page would then come stale from the cache (old totalCount).
      setChildrenPage({});
      void refetch({
        id,
        childrenFirst: settings.rowNumber,
        childrenAfter: undefined,
        childrenLast: undefined,
        childrenBefore: undefined,
      });
      notify({
        status: "success",
        text: intl.formatMessage({ id: "G5ETO0", defaultMessage: "Categories deleted" }),
      });
    },
  });

  const handleUpdate = async (formData: CategoryUpdateData): Promise<ProductErrorFragment[]> => {
    const result = await updateCategory({
      variables: {
        id,
        input: {
          name: formData.name,
          // Saleor sends the description on every save; null clears it.
          description: formData.description ? JSON.stringify(formData.description) : null,
        },
      },
    });

    return result.data?.categoryUpdate.errors ?? [];
  };

  if (!loading && !category) {
    return <NotFound />;
  }

  return (
    <>
      <CategoryUpdatePage
        categoryId={id}
        category={category}
        disabled={loading}
        errors={updateResult.data?.categoryUpdate.errors ?? []}
        saveButtonBarState={getMutationStatus({
          ...updateResult,
          errors: updateResult.data?.categoryUpdate.errors,
        })}
        onSubmit={handleUpdate}
        onDelete={() => openModal("delete")}
        onCreateSubcategory={() => openModal("create")}
        subcategoriesProps={{
          subcategories: children?.edges.map((edge) => edge.node) ?? [],
          subcategoryTotalCount: children?.totalCount,
          settings,
          onUpdateListSettings: (key, value) => {
            updateListSettings(key, value);
            setChildrenPage({});
          },
          hasNextPage: childrenPaginator.hasNextPage,
          hasPreviousPage: childrenPaginator.hasPreviousPage,
          onNextPage: () => setChildrenPage({ after: children?.pageInfo.endCursor ?? undefined }),
          onPreviousPage: () =>
            setChildrenPage({ before: children?.pageInfo.startCursor ?? undefined }),
          selectedCategoryIds: selectedChildIds,
          onSelectedCategoryIdsChange: handleSelectedChildIdsChange,
          onCategoriesDelete: () => openModal("delete-categories"),
        }}
      />
      <CategoryBulkDeleteDialog
        open={action === "delete-categories" && selectedChildIds.length > 0}
        count={selectedChildIds.length}
        confirmButtonState={getMutationStatus({
          ...bulkDeleteResult,
          errors: bulkDeleteResult.data?.categoryBulkDelete?.errors,
        })}
        onClose={closeModal}
        onConfirm={() => void bulkDeleteChildren({ variables: { ids: selectedChildIds } })}
      />
      <CreateCategoryDialog
        open={action === "create"}
        parentId={id}
        parentName={category?.name}
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
              parent: id,
              input: {
                name,
                ...(description?.blocks.length ? { description: JSON.stringify(description) } : {}),
              },
            },
          });

          return result.data?.categoryCreate.errors ?? [];
        }}
      />
      <CategoryDeleteDialog
        categoryName={<strong>{category?.name || "..."}</strong>}
        confirmButtonState={getMutationStatus({
          ...deleteResult,
          errors: deleteResult.data?.categoryDelete.errors,
        })}
        onClose={closeModal}
        onConfirm={() => deleteCategory({ variables: { id } })}
        open={action === "delete"}
      />
    </>
  );
};
