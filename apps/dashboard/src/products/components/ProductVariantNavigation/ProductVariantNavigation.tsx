// Adapted from saleor-dashboard: src/products/components/ProductVariantNavigation/ProductVariantNavigation.tsx
// and its messages (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The variant page's navigation card: the product's variants in display order with their first
// image as a thumbnail (an image placeholder when a variant has none), the open one highlighted,
// and the "Add variant" link at the bottom. Dropped: drag-to-reorder, sibling search, infinite
// scrolling, the "Default" caption and the create page's "New variant" row.
import { Box, Text } from "@saleor/macaw-ui";
import { Image } from "lucide-react";
import { defineMessages, FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
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

interface ProductVariantSiblingImage {
  id: string;
  url: string;
}

interface ProductVariantSibling {
  id: string;
  name: string;
  sku: string | null;
  /** The variant's images; the first one is the row's thumbnail. Missing on the create page. */
  media?: ReadonlyArray<ProductVariantSiblingImage>;
}

interface ProductVariantNavigationProps {
  productId: string;
  variants: ReadonlyArray<ProductVariantSibling>;
  /** The variant open in the URL. */
  current?: string;
  /** The create page has no current variant and no "Add variant" link. */
  isCreate?: boolean;
}

/** Saleor's row thumbnail: 40px, cover, inside the default border; a placeholder without one. */
const VariantThumbnail = ({ variant }: { variant: ProductVariantSibling }) => {
  const thumbnail = variant.media?.[0];

  if (thumbnail) {
    return (
      <Box
        as="img"
        width={10}
        height={10}
        objectFit="cover"
        borderRadius={2}
        borderColor="default1"
        borderStyle="solid"
        borderWidth={1}
        padding={1}
        flexShrink="0"
        src={thumbnail.url}
        alt={variant.name || variant.sku || ""}
        data-test-id="variant-thumbnail"
      />
    );
  }

  return (
    <Box
      width={10}
      height={10}
      display="flex"
      justifyContent="center"
      alignItems="center"
      borderRadius={2}
      borderColor="default1"
      borderStyle="solid"
      borderWidth={1}
      flexShrink="0"
      color="default2"
      data-test-id="variant-thumbnail-placeholder"
    >
      <Image size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
    </Box>
  );
};

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
              gap={3}
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
              <VariantThumbnail variant={variant} />
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
