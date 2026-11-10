// Adapted from saleor-dashboard: src/products/components/ProductVariants/ProductVariants.tsx and
// src/products/components/ProductVariants/components/ProductVariantsHeader.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The product page's read-only Variants card: Saleor's tinted header with the title and the
// secondary "Add variant" button, then the ported Datagrid with Variant name, SKU and Price. A row
// opens the variant page; an empty grid shows Saleor's "Use button above..." text. Not yet: cell
// editing, bulk create/update/delete, the variant generator, row checkboxes, column picker, search,
// per-channel/margin/availability/attribute/warehouse columns, staged rows and the unsaved-changes
// dialog.
import type { Item } from "@glideapps/glide-data-grid";
import { Box, Button, Text } from "@saleor/macaw-ui";
import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { Datagrid } from "../../../components/Datagrid/Datagrid";
import cardStyles from "../../../components/DetailSettingsCard/DetailSettingsCard.module.css";
import type { ProductDetailsFragment } from "../../../graphql/types.generated";
import { productVariantEditUrl } from "../../urls";
import { createGetCellContent, variantsStaticColumns } from "./datagrid";
import { messages } from "./messages";

const headerActionIconProps = {
  size: 14,
  strokeWidth: 1.5,
} as const;

interface ProductVariantsProps {
  variants: ProductDetailsFragment["variants"];
  onAddVariant: () => void;
  onRowClick: (variantId: string) => void;
}

export const ProductVariants = ({ variants, onAddVariant, onRowClick }: ProductVariantsProps) => {
  const intl = useIntl();
  const columns = useMemo(() => variantsStaticColumns(intl), [intl]);
  const getCellContent = useMemo(
    () => createGetCellContent(variants, columns, intl),
    [variants, columns, intl],
  );

  const handleRowAnchor = useCallback(
    ([, row]: Item) => {
      const variant = variants[row];

      return variant ? productVariantEditUrl(variant.id) : "";
    },
    [variants],
  );

  const handleRowClick = useCallback(
    ([, row]: Item) => {
      const variant = variants[row];

      if (variant) {
        onRowClick(variant.id);
      }
    },
    [variants, onRowClick],
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
        readonly
        hasRowHover
        verticalBorder={false}
        rowMarkers="none"
        freezeColumns={0}
        showTopBorder={false}
        availableColumns={columns}
        rows={variants.length}
        getCellContent={getCellContent}
        emptyText={intl.formatMessage(messages.empty)}
        rowAnchor={handleRowAnchor}
        onRowClick={handleRowClick}
      />
    </Box>
  );
};

ProductVariants.displayName = "ProductVariants";
