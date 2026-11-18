// Adapted from saleor-dashboard: src/products/components/ProductVariantMedia/ProductVariantMedia.tsx
// and its messages (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's variant Media card: the variant's chosen product images in the product's gallery order
// and a "Choose photos" button that opens the selection dialog. The images are the product
// gallery's tiles (MediaTile), without their overlay controls.
import { Box, Button, Skeleton, Text } from "@saleor/macaw-ui";
import { useIntl } from "react-intl";

import cardStyles from "../../../components/DetailSettingsCard/DetailSettingsCard.module.css";
import { MediaTile } from "../../../components/MediaTile/MediaTile";
import type { ProductMediaFragment } from "../../../graphql/types.generated";
import { messages } from "./messages";

interface ProductVariantMediaProps {
  /** Undefined until the variant query resolves; the card shows a skeleton meanwhile. */
  media: ProductMediaFragment[] | undefined;
  /** While loading or when the product has no images to choose from. */
  disabled: boolean;
  onImageAdd: () => void;
}

export const ProductVariantMedia = ({ media, disabled, onImageAdd }: ProductVariantMediaProps) => {
  const intl = useIntl();

  return (
    <Box className={cardStyles.card} data-test-id="variant-media">
      <Box className={[cardStyles.header, cardStyles.headerWithEnd].join(" ")}>
        <Box className={cardStyles.headerMain}>
          <Text size={5} fontWeight="bold" as="h2" className={cardStyles.title}>
            {intl.formatMessage(messages.media)}
          </Text>
        </Box>
        <Box className={cardStyles.headerEnd}>
          <Button
            variant="secondary"
            size="small"
            type="button"
            disabled={disabled}
            onClick={onImageAdd}
            data-test-id="choose-media-button"
          >
            {intl.formatMessage(messages.chooseMedia)}
          </Button>
        </Box>
      </Box>
      <Box className={cardStyles.content}>
        <Box display="flex" flexWrap="wrap" gap={5}>
          {media === undefined ? (
            <Skeleton height={7} />
          ) : media.length > 0 ? (
            media.map((mediaObject) => (
              <MediaTile key={mediaObject.id} media={mediaObject} disableOverlay />
            ))
          ) : (
            <Text size={3} color="default2">
              {intl.formatMessage(messages.selectSpecificVariant)}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

ProductVariantMedia.displayName = "ProductVariantMedia";
