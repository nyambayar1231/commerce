// Adapted from saleor-dashboard: src/categories/components/CategoryListPage/CategoryListPage.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The header only. Saleor shows "All Categories" as the label of its filter-presets dropdown
// (FilterPresetsSelect) next to a hidden TopNav title; without presets we show that label as text.
// The search bar and the Datagrid card arrive with the list (M2.1.7–M2.1.8); extension menu items
// and the create-button dropdown for extensions are omitted.
import { Box, Button, Text } from "@saleor/macaw-ui";
import { FormattedMessage, useIntl } from "react-intl";

import { TopNav } from "../../../components/AppLayout/TopNav";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { sectionNames } from "../../../intl";
import { messages } from "./messages";

interface CategoryListPageProps {
  onCreateCategory: () => void;
}

export const CategoryListPage = ({ onCreateCategory }: CategoryListPageProps) => {
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
    </ListPageLayout>
  );
};
