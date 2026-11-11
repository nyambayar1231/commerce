// Adapted from saleor-dashboard: src/products/components/ProductListTiles/ProductListTiles.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's tile grid: six tiles per row on desktop (five on tablet, three on mobile), a spinner
// while loading, the datagrid's empty text in a Placeholder, and our shared pagination below.
// Tile view has no row selection or bulk actions (Saleor's has none).
import { Box, Spinner, vars } from "@saleor/macaw-ui";
import { useCallback } from "react";
import { useIntl } from "react-intl";

import { Placeholder } from "../../../components/Placeholder/Placeholder";
import { DatagridPagination } from "../../../components/TablePagination/DatagridPagination";
import type { ProductListRowFragment } from "../../../graphql/types.generated";
import type { ListSettings, ListSettingsUpdate } from "../../../hooks/useListSettings";
import { messages } from "../ProductListDatagrid/messages";
import { ProductTile } from "../ProductTile/ProductTile";

interface ProductListTilesProps {
  rows: ProductListRowFragment[];
  disabled: boolean;
  settings?: ListSettings;
  onUpdateListSettings?: ListSettingsUpdate;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  nextHref?: string;
  prevHref?: string;
  onTileClick: (id: string) => void;
}

export const ProductListTiles = ({
  rows,
  disabled,
  settings,
  onUpdateListSettings,
  hasNextPage,
  hasPreviousPage,
  nextHref,
  prevHref,
  onTileClick,
}: ProductListTilesProps) => {
  const intl = useIntl();
  const renderContent = useCallback(() => {
    if (disabled) {
      return (
        <Box display="flex" justifyContent="center" marginY={9}>
          <Spinner />
        </Box>
      );
    }

    if (rows.length > 0) {
      return (
        <Box
          display="grid"
          gridTemplateColumns={{ mobile: 3, tablet: 5, desktop: 6 }}
          gap={6}
          paddingX={6}
          __paddingTop={`calc(${vars.spacing[9]} - ${vars.spacing[5]})`}
          data-test-id="tile-view"
        >
          {rows.map((product) => (
            <ProductTile
              key={product.id}
              product={product}
              onClick={() => onTileClick(product.id)}
            />
          ))}
        </Box>
      );
    }

    return (
      <Box paddingX={6} paddingBottom={6}>
        <Placeholder>
          <span data-test-id="empty-data-grid-text">{intl.formatMessage(messages.noData)}</span>
        </Placeholder>
      </Box>
    );
  }, [intl, disabled, onTileClick, rows]);

  return (
    <>
      {renderContent()}
      <DatagridPagination
        settings={settings}
        disabled={disabled}
        onUpdateListSettings={onUpdateListSettings}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        nextHref={nextHref}
        prevHref={prevHref}
      />
    </>
  );
};
