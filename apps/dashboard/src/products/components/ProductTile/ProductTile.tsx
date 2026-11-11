// Adapted from saleor-dashboard: src/products/components/ProductTile/ProductTile.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's product tile: the square thumbnail (or its empty-image placeholder) over a status dot
// with a small label, then the product name, with the hover highlight behind it. We have no product
// types, so the small label is our single-channel availability ("Published"/"Hidden"); the dot uses
// the same status rule.
import { Box, Text, vars } from "@saleor/macaw-ui";
import { Image } from "lucide-react";
import { useIntl } from "react-intl";

import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import { StatusDot } from "../../../components/StatusDot/StatusDot";
import type { ProductListRowFragment } from "../../../graphql/types.generated";
import { messages } from "../ProductListDatagrid/messages";
import { getTileStatus } from "./utils";

interface ProductTileProps {
  product: ProductListRowFragment;
  onClick: () => void;
}

const commonThumbnailProps = {
  marginBottom: 1.5,
  borderRadius: 3,
  aspectRatio: "1 / 1",
} as const;

export const ProductTile = ({ product, onClick }: ProductTileProps) => {
  const intl = useIntl();
  const status = getTileStatus(product, Date.now());

  return (
    <Box
      display="flex"
      flexDirection="column"
      onClick={onClick}
      cursor="pointer"
      borderRadius={3}
      position="relative"
      data-test-id={`product-tile-${product.id}`}
    >
      {product.thumbnail ? (
        <Box
          {...commonThumbnailProps}
          as="img"
          alt={product.name}
          objectFit="cover"
          src={product.thumbnail.url}
        />
      ) : (
        <Box
          {...commonThumbnailProps}
          display="flex"
          alignItems="center"
          justifyContent="center"
          borderWidth={1}
          borderStyle="solid"
          borderColor="default1"
          color="defaultDisabled"
        >
          <Image
            size={iconSize.large}
            strokeWidth={iconStrokeWidthBySize.large}
            data-test-id={`placeholder-svg-${product.id}`}
          />
        </Box>
      )}
      <Box display="flex" alignItems="center">
        <Box paddingRight={1}>
          <StatusDot status={status} />
        </Box>
        <Text ellipsis color="default2" size={1} alignItems="center" paddingY={0.5}>
          {intl.formatMessage(status === "success" ? messages.published : messages.hidden)}
        </Text>
      </Box>
      <Box display="flex" justifyContent="space-between" marginTop={0.5}>
        <Text ellipsis color="default1" size={3} fontWeight="medium">
          {product.name}
        </Text>
      </Box>
      <Box
        position="absolute"
        margin="auto"
        __right={`calc(${vars.spacing[5]} / -2)`}
        __top={`calc(${vars.spacing[5]} / -2)`}
        __width={`calc(100% + ${vars.spacing[5]})`}
        __height={`calc(100% + ${vars.spacing[5]})`}
        __opacity={0.1}
        borderRadius={5}
        backgroundColor={{ hover: "default1Hovered" }}
      />
    </Box>
  );
};
