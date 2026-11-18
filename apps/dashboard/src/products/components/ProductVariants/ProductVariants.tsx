// Adapted from saleor-dashboard: src/products/components/ProductVariants/ProductVariants.tsx and
// src/products/components/ProductVariants/components/ProductVariantsHeader.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product page's Variants card: Saleor's tinted header with the title and the secondary
// "Add variant" button, then the ported Datagrid with Variant name, SKU, Price and one column per
// warehouse (Saleor's normal view). The cells are editable (name and SKU as text, price and each
// warehouse as a whole number); an edit tints its cell until the page's Save, which saves it with
// the product form, and a rejected row's cells turn red. The row's pencil opens the variant page
// (Saleor's single menu item); a cell click selects the cell for editing instead of navigating.
// An empty grid shows Saleor's "Use button above..." text. Not yet: bulk create/update/delete,
// search, fullscreen/ghost rows, the variant generator, row checkboxes, the column picker,
// per-channel/margin/availability/attribute columns and variant media.
import type { Item } from "@glideapps/glide-data-grid";
import { Box, Button, Text } from "@saleor/macaw-ui";
import { Pencil, Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import type { RowActionItem } from "../../../components/Datagrid/components/RowActions";
import type { GetCellContentOpts } from "../../../components/Datagrid/Datagrid";
import { Datagrid } from "../../../components/Datagrid/Datagrid";
import type { OnDatagridChange } from "../../../components/Datagrid/hooks/useDatagridChange";
import cardStyles from "../../../components/DetailSettingsCard/DetailSettingsCard.module.css";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import type { ProductDetailsFragment } from "../../../graphql/types.generated";
import {
  createGetCellContent,
  hasVariantGridError,
  isValidVariantGridNumber,
  isVariantGridNumberColumn,
  parseWarehousesColumns,
  type VariantGridError,
  variantsStaticColumns,
} from "./datagrid";
import { messages } from "./messages";

const headerActionIconProps = {
  size: 14,
  strokeWidth: 1.5,
} as const;

interface ProductVariantsProps {
  variants: ProductDetailsFragment["variants"];
  /** One column per warehouse (Saleor's warehouse columns, no column picker). */
  warehouses: { id: string; name: string }[];
  /** A rejected row's cells, tinted red until the next save. */
  errors: VariantGridError[];
  onAddVariant: () => void;
  /** Opens a variant's page (the row's pencil). */
  onRowClick: (variantId: string) => void;
  /** Hears the grid's edits; the page keeps them until Save. */
  onChange: OnDatagridChange;
}

export const ProductVariants = ({
  variants,
  warehouses,
  errors,
  onAddVariant,
  onRowClick,
  onChange,
}: ProductVariantsProps) => {
  const intl = useIntl();
  const columns = useMemo(
    () => [...variantsStaticColumns(intl), ...parseWarehousesColumns(warehouses)],
    [intl, warehouses],
  );
  const getCellContent = useMemo(
    () => createGetCellContent(variants, columns),
    [variants, columns],
  );

  const getCellError = useCallback(
    ([column, row]: Item, { changes, getChangeIndex }: GetCellContentOpts): boolean => {
      const columnId = columns[column]?.id;
      const variant = variants[row];

      if (!columnId || !variant) {
        return false;
      }

      if (hasVariantGridError(errors, variant.id, columnId)) {
        return true;
      }

      // An invalid number is never sent: its cell stays red until it is fixed.
      return (
        isVariantGridNumberColumn(columnId) &&
        !isValidVariantGridNumber(columnId, changes.current[getChangeIndex(columnId, row)])
      );
    },
    [columns, errors, variants],
  );

  const getMenuItems = useCallback(
    (index: number): RowActionItem[] => {
      const variant = variants[index];

      if (!variant) {
        return [];
      }

      return [
        {
          label: intl.formatMessage(messages.editVariant),
          testId: "edit-variant",
          icon: <Pencil size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />,
          onSelect: () => onRowClick(variant.id),
        },
      ];
    },
    [intl, onRowClick, variants],
  );

  return (
    <Box className={cardStyles.card} data-test-id="product-variants">
      <Box className={[cardStyles.header, cardStyles.headerWithEnd].join(" ")}>
        <Box className={cardStyles.headerMain}>
          <Text size={5} fontWeight="bold" as="h2" className={cardStyles.title}>
            {intl.formatMessage(messages.title)}
          </Text>
        </Box>
        <Box className={cardStyles.headerEnd}>
          <Button
            data-test-id="button-add-variant"
            variant="secondary"
            size="small"
            onClick={onAddVariant}
            icon={<Plus {...headerActionIconProps} />}
          >
            <FormattedMessage {...messages.addVariant} />
          </Button>
        </Box>
      </Box>
      <Datagrid
        fillHandle
        verticalBorder={false}
        rowMarkers="none"
        freezeColumns={0}
        showTopBorder={false}
        availableColumns={columns}
        rows={variants.length}
        getCellContent={getCellContent}
        getCellError={getCellError}
        menuItems={getMenuItems}
        onChange={onChange}
        emptyText={intl.formatMessage(messages.empty)}
      />
    </Box>
  );
};

ProductVariants.displayName = "ProductVariants";
