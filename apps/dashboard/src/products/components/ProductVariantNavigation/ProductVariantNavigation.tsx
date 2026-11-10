// Adapted from saleor-dashboard: src/products/components/ProductVariantNavigation/ProductVariantNavigation.tsx
// and its messages (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variant page's navigation card: the product's variants in display order, the open one
// highlighted, and the "Add variant" link at the bottom. Dropped: drag-to-reorder, sibling search,
// infinite scrolling, thumbnails, the "Default" caption and the create page's "New variant" row.
import { Box, Text } from "@saleor/macaw-ui";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import { productVariantAddUrl, productVariantEditUrl } from "../../urls";

const messages = defineMessages({
  title: {
    id: "8GC/ah",
    defaultMessage: "Variants",
    description: "variants section name",
  },
  addVariant: {
    id: "3C3Nj5",
    defaultMessage: "Add variant",
    description: "button",
  },
});

interface ProductVariantSibling {
  id: string;
  name: string;
  sku: string | null;
}

interface ProductVariantNavigationProps {
  productId: string;
  variants: ReadonlyArray<ProductVariantSibling>;
  /** The variant open in the URL. */
  current?: string;
  /** The create page has no current variant and no "Add variant" link. */
  isCreate?: boolean;
}

export const ProductVariantNavigation = ({
  productId,
  variants,
  current,
  isCreate = false,
}: ProductVariantNavigationProps) => {
  const intl = useIntl();

  return (
    <DetailSettingsCard
      contentFlush
      title={intl.formatMessage(messages.title)}
      data-test-id="variant-navigation"
    >
      {variants.map((variant, index) => {
        const isActive = variant.id === current;

        return (
          <Link
            key={variant.id}
            to={productVariantEditUrl(variant.id)}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            <Box
              display="flex"
              alignItems="center"
              paddingX={4}
              paddingY={3}
              borderLeftStyle="solid"
              __borderLeftWidth={2}
              borderColor={isActive ? "accent1" : "transparent"}
              backgroundColor={isActive ? "default2" : { hover: "default1Hovered" }}
              borderBottomStyle="solid"
              borderBottomWidth={index === variants.length - 1 ? 0 : 1}
              data-test-id="variant-row"
              data-variant-id={variant.id}
              aria-current={isActive ? "page" : undefined}
            >
              <Text size={2} fontWeight={isActive ? "medium" : "regular"} ellipsis display="block">
                {variant.name || variant.sku || ""}
              </Text>
            </Box>
          </Link>
        );
      })}
      {!isCreate ? (
        <Box
          paddingX={4}
          paddingY={3}
          borderTopStyle="solid"
          borderColor="default1"
          borderTopWidth={1}
        >
          <Link to={productVariantAddUrl(productId)} data-test-id="add-variant">
            <Text size={2} color="accent1">
              <FormattedMessage {...messages.addVariant} />
            </Text>
          </Link>
        </Box>
      ) : null}
    </DetailSettingsCard>
  );
};

ProductVariantNavigation.displayName = "ProductVariantNavigation";
