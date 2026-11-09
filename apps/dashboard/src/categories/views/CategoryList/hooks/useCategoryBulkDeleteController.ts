// Adapted from saleor-dashboard: src/categories/views/CategoryList/hooks/useCategoryBulkDeleteController.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useMutation } from "@apollo/client";
import { useCallback, useRef } from "react";
import {
  CategoryBulkDeleteDocument,
  type CategoryBulkDeleteMutation,
  type CategoryFragment,
} from "../../../../graphql/types.generated";

import type { CategoryListRow } from "../types";
import { buildParentByCategoryId, collectDescendantIds } from "../utils/categoryTree";

interface UseCategoryBulkDeleteControllerArgs {
  selectedRowIds: string[];
  visibleRows: CategoryListRow[];
  getCachedChildrenByParentId: (parentId: string) => CategoryFragment[];
  pruneTreeStateAfterDelete: (
    deletedIdsWithDescendants: Set<string>,
    parentIdsToInvalidate: Set<string>,
  ) => void;
  refreshParentChildren: (parentIds: string[]) => Promise<void>;
  clearRowSelection: () => void;
  refetchRootCategories: () => void;
  navigateToList: () => void;
  notifyDeleted: () => void;
}

interface UseCategoryBulkDeleteController {
  categoryBulkDeleteOpts: ReturnType<typeof useMutation<CategoryBulkDeleteMutation>>[1];
  handleCategoryBulkDelete: () => Promise<void>;
}

export const useCategoryBulkDeleteController = ({
  selectedRowIds,
  visibleRows,
  getCachedChildrenByParentId,
  pruneTreeStateAfterDelete,
  refreshParentChildren,
  clearRowSelection,
  refetchRootCategories,
  navigateToList,
  notifyDeleted,
}: UseCategoryBulkDeleteControllerArgs): UseCategoryBulkDeleteController => {
  const deletingCategoryIdsRef = useRef<string[]>([]);

  const handleCategoryBulkDeleteOnComplete = useCallback(
    (data: CategoryBulkDeleteMutation): void => {
      if (data?.categoryBulkDelete?.errors.length !== 0) {
        return;
      }

      const deletedIds = new Set(deletingCategoryIdsRef.current);
      const deletedIdsWithDescendants = new Set(deletedIds);

      deletedIds.forEach((deletedId) => {
        collectDescendantIds(deletedId, getCachedChildrenByParentId).forEach((descendantId) => {
          deletedIdsWithDescendants.add(descendantId);
        });
      });

      const parentByCategoryId = buildParentByCategoryId(visibleRows);
      const parentIdsToInvalidate = new Set<string>();

      deletedIdsWithDescendants.forEach((deletedId) => {
        let parentId = parentByCategoryId[deletedId];

        while (parentId) {
          parentIdsToInvalidate.add(parentId);
          parentId = parentByCategoryId[parentId];
        }
      });

      pruneTreeStateAfterDelete(deletedIdsWithDescendants, parentIdsToInvalidate);

      const parentIdsToRefetch = Array.from(parentIdsToInvalidate);

      if (parentIdsToRefetch.length > 0) {
        void refreshParentChildren(parentIdsToRefetch);
      }

      navigateToList();
      refetchRootCategories();
      clearRowSelection();
      deletingCategoryIdsRef.current = [];
      notifyDeleted();
    },
    [
      clearRowSelection,
      getCachedChildrenByParentId,
      navigateToList,
      notifyDeleted,
      pruneTreeStateAfterDelete,
      refetchRootCategories,
      refreshParentChildren,
      visibleRows,
    ],
  );

  const [categoryBulkDelete, categoryBulkDeleteOpts] = useMutation(CategoryBulkDeleteDocument, {
    onCompleted: handleCategoryBulkDeleteOnComplete,
  });

  const handleCategoryBulkDelete = useCallback(async (): Promise<void> => {
    deletingCategoryIdsRef.current = [...selectedRowIds];

    await categoryBulkDelete({
      variables: {
        ids: selectedRowIds,
      },
    });

    clearRowSelection();
  }, [categoryBulkDelete, clearRowSelection, selectedRowIds]);

  return {
    categoryBulkDeleteOpts,
    handleCategoryBulkDelete,
  };
};
