// Adapted from saleor-dashboard: src/components/MediaTile/MediaTile.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One image tile of the product media gallery: the image, a hover overlay and a delete button.
// Images only, so there is no oEmbed thumbnail and no edit link or selection checkbox (single
// delete, M2.5.3a); the image detail page arrives with M2.5.3b.
import { Spinner } from "@saleor/macaw-ui";
import { Trash2 } from "lucide-react";

import { iconSize, iconStrokeWidthBySize } from "../icons";
import styles from "./MediaTile.module.css";

interface MediaTileProps {
  media: {
    alt: string;
    url: string;
  };
  loading?: boolean;
  disableOverlay?: boolean;
  onDelete?: () => void;
}

export const MediaTile = ({
  media,
  loading = false,
  disableOverlay = false,
  onDelete,
}: MediaTileProps) => (
  <div className={styles.mediaContainer} data-test-id="product-image">
    {onDelete && !loading ? (
      <div className={styles.tileControls}>
        {!disableOverlay ? (
          <div className={styles.mediaOverlayToolbar}>
            <button
              type="button"
              className={styles.controlButton}
              onClick={onDelete}
              aria-label="Delete image"
              data-test-id="product-media-delete"
            >
              <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
            </button>
          </div>
        ) : null}
      </div>
    ) : null}
    <div
      className={[
        styles.mediaOverlay,
        disableOverlay && styles.disableOverlay,
        loading && styles.mediaOverlayLoading,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading ? (
        <span data-test-id="media-tile-loading">
          <Spinner />
        </span>
      ) : null}
    </div>
    <img className={styles.media} src={media.url} alt={media.alt} />
  </div>
);

MediaTile.displayName = "MediaTile";
