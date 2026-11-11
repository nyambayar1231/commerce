// Adapted from saleor-dashboard: src/products/components/ProductMediaNavigation/ProductMediaNavigation.tsx
// and its messages (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The image page's navigation card: the product's images in display order as small thumbnails,
// the open one highlighted, each opening its image page. Images only (there is no oEmbed preview
// to unwrap) and no drag here: reordering belongs to the product page's Media card.
import { Box, Skeleton } from "@saleor/macaw-ui";
import { defineMessages, useIntl } from "react-intl";

import { DetailSettingsCard } from "../../../components/DetailSettingsCard/DetailSettingsCard";
import styles from "./ProductMediaNavigation.module.css";

const skeletonThumbnailKeys = ["first", "second", "third", "fourth"];

const messages = defineMessages({
  allMedia: {
    id: "XUU9sU",
    defaultMessage: "All Media",
    description: "section header",
  },
});

interface ProductMediaNavigationProps {
  /** Undefined until the product's media resolve: the card shows placeholder tiles. */
  media?: ReadonlyArray<{ id: string; url: string; alt: string }>;
  /** The media open in the URL. */
  highlighted?: string;
  onRowClick: (id: string) => () => void;
}

export const ProductMediaNavigation = ({
  media,
  highlighted,
  onRowClick,
}: ProductMediaNavigationProps) => {
  const intl = useIntl();

  return (
    <DetailSettingsCard
      title={intl.formatMessage(messages.allMedia)}
      data-test-id="product-media-navigation"
    >
      {!media ? (
        <div className={styles.root} data-test-id="product-media-navigation-skeleton">
          {skeletonThumbnailKeys.map((key) => (
            <Box key={key} className={[styles.imageContainer, styles.skeleton].join(" ")}>
              <Skeleton __width="100%" __height="100%" borderRadius={2} />
            </Box>
          ))}
        </div>
      ) : (
        <div className={styles.root}>
          {media.map((mediaObject) => {
            const isActive = mediaObject.id === highlighted;

            return (
              <button
                key={mediaObject.id}
                type="button"
                className={[styles.imageContainer, isActive && styles.highlightedImageContainer]
                  .filter(Boolean)
                  .join(" ")}
                onClick={onRowClick(mediaObject.id)}
                data-test-id="product-media-navigation-item"
                data-media-id={mediaObject.id}
                aria-current={isActive ? "page" : undefined}
              >
                <img className={styles.image} src={mediaObject.url} alt={mediaObject.alt} />
              </button>
            );
          })}
        </div>
      )}
    </DetailSettingsCard>
  );
};

ProductMediaNavigation.displayName = "ProductMediaNavigation";
