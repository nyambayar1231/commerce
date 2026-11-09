// Adapted from saleor-dashboard: src/categories/components/CategoryListPage/CategoryListPage.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The header only. Saleor shows "All Categories" as the label of its filter-presets dropdown
// (FilterPresetsSelect) next to a hidden TopNav title; without presets we show that label as text.
// Then Saleor's card: search, "Collapse all" (tree rows), "Delete categories (N)" while rows are
// selected, the grid and its pagination; extension menu items and the extensions create-button dropdown are omitted.
import { Box, Button, Text } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { BulkDeleteButton } from "../../../components/BulkDeleteButton/BulkDeleteButton";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { ListSearchInput } from "../../../components/ListSearchInput/ListSearchInput";
import { sectionNames } from "../../../intl";
import { CategoryListDatagrid } from "../CategoryListDatagrid/CategoryListDatagrid";
import { messages } from "./messages";

interface CategoryListPageProps extends ComponentProps<typeof CategoryListDatagrid> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
  hasExpandedSubcategories: boolean;
  onCollapseAllSubcategories: () => void;
  selectedCategoriesIds: string[];
  onCategoriesDelete: () => void;
  onCreateCategory: () => void;
}

export const CategoryListPage = ({
  initialSearch,
  onSearchChange,
  hasExpandedSubcategories,
  onCollapseAllSubcategories,
  selectedCategoriesIds,
  onCategoriesDelete,
  onCreateCategory,
  ...listProps
}: CategoryListPageProps) => {
  const intl = useIntl();

  return (
    <ListPageLayout>
      <TopNav
        title={intl.formatMessage(sectionNames.categories)}
        isAlignToRight={false}
        withoutBorder
      >
        <Box __flex={1} display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex">
            <Text size={6}>
              <FormattedMessage {...messages.allCategories} />
            </Text>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Button data-test-id="create-category" onClick={onCreateCategory} variant="primary">
              <FormattedMessage {...messages.createCategory} />
            </Button>
          </Box>
        </Box>
      </TopNav>
      <DashboardCard>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          paddingX={6}
          marginBottom={2}
        >
          <Box __width="320px">
            <ListSearchInput
              initialSearch={initialSearch}
              placeholder={intl.formatMessage(messages.searchCategory)}
              onSearchChange={onSearchChange}
            />
          </Box>
          <Box display="flex" alignItems="center" gap={4}>
            <Button
              variant="secondary"
              onClick={onCollapseAllSubcategories}
              disabled={!hasExpandedSubcategories}
              data-test-id="collapse-all-subcategories"
            >
              <FormattedMessage {...messages.collapseAllSubcategories} />
            </Button>
            {selectedCategoriesIds.length > 0 && (
              <BulkDeleteButton count={selectedCategoriesIds.length} onClick={onCategoriesDelete}>
                <FormattedMessage {...messages.bulkCategoryDelete} />
              </BulkDeleteButton>
            )}
          </Box>
        </Box>
        <CategoryListDatagrid {...listProps} />
      </DashboardCard>
    </ListPageLayout>
  );
};
