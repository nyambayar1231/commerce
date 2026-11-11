// Adapted from saleor-dashboard: src/products/components/ProductListPage/ProductListPage.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The header and card. Saleor shows "All products" as the label of its filter-presets dropdown
// (FilterPresetsSelect) next to a hidden TopNav title; without presets we show that label as text.
// Saleor's create-button dropdown becomes a plain "Create Product" button (no product types or
// extensions). Then Saleor's card: search and, while rows are selected, the bulk delete button
// from Saleor's list toolbar, the List/Grid view switch, then the datagrid or the tile grid with
// their pagination. Not yet: export/extension menus, the create-button dropdown, limits and filter
// presets.
import { Box, Button, Text } from "@saleor/macaw-ui";
import type { ComponentProps } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { ListFilters } from "../../../components/AppLayout/ListFilters/ListFilters";
import { TopNav } from "../../../components/AppLayout/TopNav";
import { BulkDeleteButton } from "../../../components/BulkDeleteButton/BulkDeleteButton";
import { DashboardCard } from "../../../components/Card";
import { ListPageLayout } from "../../../components/Layouts/List/Root";
import useLocalStorage from "../../../hooks/useLocalStorage";
import { sectionNames } from "../../../intl";
import { productUrl } from "../../urls";
import { ProductListDatagrid } from "../ProductListDatagrid/ProductListDatagrid";
import { ProductListTiles } from "../ProductListTiles/ProductListTiles";
import { ProductListViewSwitch } from "../ProductListViewSwitch/ProductListViewSwitch";
import { messages } from "./messages";

export type ProductListViewType = "datagrid" | "tile";

const DEFAULT_PRODUCT_LIST_VIEW_TYPE: ProductListViewType = "datagrid";

interface ProductListPageProps extends ComponentProps<typeof ProductListDatagrid> {
  initialSearch: string;
  onSearchChange: (query: string) => void;
  onAdd: () => void;
  selectedProductIds: string[];
  onProductsDelete: () => void;
  clearRowSelection: () => void;
}

export const ProductListPage = ({
  initialSearch,
  onSearchChange,
  onAdd,
  selectedProductIds,
  onProductsDelete,
  clearRowSelection,
  ...listProps
}: ProductListPageProps) => {
  const intl = useIntl();
  const navigate = useNavigate();
  // Saleor's productListViewType: the chosen view survives a reload in localStorage.
  const [storedProductListViewType, setProductListViewType] = useLocalStorage<ProductListViewType>(
    "productListViewType",
    DEFAULT_PRODUCT_LIST_VIEW_TYPE,
  );
  const isDatagridView = storedProductListViewType === "datagrid";

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
          <Box display="flex" alignItems="center" gap={2}>
            <Button data-test-id="add-product" variant="primary" onClick={onAdd}>
              <FormattedMessage {...messages.createProduct} />
            </Button>
          </Box>
        </Box>
      </TopNav>
      <DashboardCard>
        <ListFilters
          initialSearch={initialSearch}
          searchPlaceholder={intl.formatMessage(messages.searchProducts)}
          onSearchChange={onSearchChange}
          actions={
            <Box display="flex" gap={4} alignItems="center">
              {selectedProductIds.length > 0 && (
                <BulkDeleteButton count={selectedProductIds.length} onClick={onProductsDelete}>
                  <FormattedMessage {...messages.deleteProducts} />
                </BulkDeleteButton>
              )}
              <ProductListViewSwitch
                defaultValue={storedProductListViewType}
                setProductListViewType={(value) => {
                  setProductListViewType(value);
                  clearRowSelection();
                }}
              />
            </Box>
          }
        />
        {isDatagridView ? (
          <ProductListDatagrid {...listProps} />
        ) : (
          <ProductListTiles
            rows={listProps.rows}
            disabled={listProps.disabled}
            settings={listProps.settings}
            onUpdateListSettings={listProps.onUpdateListSettings}
            hasNextPage={listProps.hasNextPage}
            hasPreviousPage={listProps.hasPreviousPage}
            nextHref={listProps.nextHref}
            prevHref={listProps.prevHref}
            onTileClick={(id) => navigate(productUrl(id))}
          />
        )}
      </DashboardCard>
    </ListPageLayout>
  );
};
