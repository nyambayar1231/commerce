// Adapted from saleor-dashboard: src/categories/components/CategorySubcategories/CategorySubcategories.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The detail page's Subcategories card: header with the count, intro, the children in the compact
// grid (or "No categories found"), "Delete categories (N)" for selected rows, "Create subcategory",
// and pagination. Not yet: expanding children inside the card ("Collapse all"); Saleor's
// AssignableListPagination is our TablePagination.
import { Box, Button, Text } from "@saleor/macaw-ui";
import { FormattedMessage } from "react-intl";

import { BulkDeleteButton } from "../../../components/BulkDeleteButton/BulkDeleteButton";
import { TablePagination } from "../../../components/TablePagination/TablePagination";
import type { CategoryFragment } from "../../../graphql/types.generated";
import type { ListSettings, ListSettingsUpdate } from "../../../hooks/useListSettings";
import { CategoryListDatagrid } from "../CategoryListDatagrid/CategoryListDatagrid";
import styles from "./CategorySubcategories.module.css";
import { messages } from "./messages";

interface CategorySubcategoriesProps {
  disabled: boolean;
  subcategories: CategoryFragment[];
  subcategoryTotalCount?: number | null;
  settings: ListSettings;
  onUpdateListSettings: ListSettingsUpdate;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  selectedCategoryIds: string[];
  onSelectedCategoryIdsChange: (ids: string[], clearSelection: () => void) => void;
  onCategoriesDelete: () => void;
  onCreateSubcategory: () => void;
}

export const CategorySubcategories = ({
  disabled,
  subcategories,
  subcategoryTotalCount,
  settings,
  onUpdateListSettings,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  selectedCategoryIds,
  onSelectedCategoryIdsChange,
  onCategoriesDelete,
  onCreateSubcategory,
}: CategorySubcategoriesProps) => {
  const count = subcategoryTotalCount ?? subcategories.length;
  const hasSubcategories = subcategories.length > 0;

  return (
    <Box className={styles.card} data-test-id="category-subcategories">
      <Box className={styles.header}>
        <Text size={5} fontWeight="bold" as="h2" className={styles.headerTitle}>
          <FormattedMessage {...messages.title} />
        </Text>
        <Text size={2} color="default2" className={styles.headerCount}>
          <FormattedMessage
            id="Bfh6NP"
            defaultMessage="{count, plural, one {# subcategory} other {# subcategories}}"
            description="sidebar header meta for number of child categories"
            values={{ count }}
          />
        </Text>
      </Box>

      <Box className={styles.intro}>
        <Text size={3} color="default2">
          <FormattedMessage {...messages.intro} />
        </Text>
      </Box>

      {hasSubcategories ? (
        <Box className={styles.list}>
          <CategoryListDatagrid
            variant="sidebar"
            disabled={disabled}
            rows={subcategories.map((category) => ({
              type: "category",
              category,
              depth: 0,
              parentId: null,
            }))}
            onSelectedCategoriesIdsChange={onSelectedCategoryIdsChange}
          />
        </Box>
      ) : (
        <Box className={styles.emptyState} data-test-id="empty-data-grid-text">
          <Text size={2} color="default2">
            <FormattedMessage {...messages.empty} />
          </Text>
        </Box>
      )}

      <Box className={styles.listFooter}>
        <Box className={styles.footerToolbar}>
          <Box className={styles.actions}>
            {hasSubcategories && selectedCategoryIds.length > 0 ? (
              <BulkDeleteButton
                count={selectedCategoryIds.length}
                onClick={onCategoriesDelete}
                disabled={disabled}
                size="small"
              >
                <FormattedMessage {...messages.deleteSelected} />
              </BulkDeleteButton>
            ) : null}
            <Button
              variant="secondary"
              type="button"
              data-test-id="create-subcategory"
              disabled={disabled}
              onClick={onCreateSubcategory}
            >
              <FormattedMessage {...messages.create} />
            </Button>
          </Box>
        </Box>
      </Box>

      {hasSubcategories ? (
        <Box paddingX={4} paddingBottom={4}>
          <TablePagination
            settings={settings}
            onUpdateListSettings={onUpdateListSettings}
            disabled={disabled}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            onNextPage={onNextPage}
            onPreviousPage={onPreviousPage}
          />
        </Box>
      ) : null}
    </Box>
  );
};
