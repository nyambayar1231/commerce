// Adapted from saleor-dashboard: src/products/components/ProductListPage/ProductListPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The header and card. Saleor shows "All products" as the label of its filter-presets dropdown
// (FilterPresetsSelect) next to a hidden TopNav title; without presets we show that label as text.
// Then Saleor's card: search and the grid with its pagination. Not yet: the Create product button
// (M2.4), export/extension menus, limits, the view switch, bulk delete and filter presets.
import { Box, Text } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { ListFilters } from "../../../components/AppLayout/ListFilters/ListFilters";
import { TopNav } from "../../../components/AppLayout/TopNav";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import { sectionNames } from "../../../intl";
import { ProductListDatagrid } from "../ProductListDatagrid/ProductListDatagrid";
import { messages } from "./messages";

interface ProductListPageProps extends ComponentProps<typeof ProductListDatagrid> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
}

export const ProductListPage = ({
  initialSearch,
  onSearchChange,
  ...listProps
}: ProductListPageProps) => {
  const intl = useIntl();

  return (
    <ListPageLayout>
      <TopNav
        title={intl.formatMessage(sectionNames.products)}
        isAlignToRight={false}
        withoutBorder
      >
        <Box __flex={1} display="flex" justifyContent="space-between" alignItems="center">
          <Text size={6}>
            <FormattedMessage {...messages.allProducts} />
          </Text>
        </Box>
      </TopNav>
      <DashboardCard>
        <ListFilters
          initialSearch={initialSearch}
          searchPlaceholder={intl.formatMessage(messages.searchProducts)}
          onSearchChange={onSearchChange}
        />
        <ProductListDatagrid {...listProps} />
      </DashboardCard>
    </ListPageLayout>
  );
};
