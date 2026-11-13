// Adapted from saleor-dashboard: src/components/MediaTile/MediaTile.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// One image tile of the product media gallery: the image, a hover overlay and the edit link /
// delete button. Images only, so there is no oEmbed thumbnail and no selection checkbox (single
// delete, M2.5.3a); `editHref` opens the image detail page (M2.5.3b).
import { Spinner } from "@saleor/macaw-ui";
import { Pencil, Trash2 } from "lucide-react";
import { useIntl } from "react-intl";
import { Link } from "react-router";

import { iconSize, iconStrokeWidthBySize } from "../icons";
import styles from "./MediaTile.module.css";

interface MediaTileProps {
  media: {
    alt: string;
    url: string;
  };
  loading?: boolean;
  disableOverlay?: boolean;
  /** The image page's URL; omitted for tiles without a saved row (pending uploads, drag ghost). */
  editHref?: string;
  onDelete?: () => void;
}

export const MediaTile = ({
  media,
  loading = false,
  disableOverlay = false,
  editHref,
  onDelete,
}: MediaTileProps) => {
  const intl = useIntl();
  const isEditable = editHref !== undefined || onDelete !== undefined;

  return (
    <div className={styles.mediaContainer} data-test-id="product-image">
      {isEditable && !loading ? (
        <div className={styles.tileControls}>
          {!disableOverlay ? (
            <div className={styles.mediaOverlayToolbar}>
              {editHref !== undefined ? (
                <Link
                  className={styles.controlButton}
                  to={editHref}
                  aria-label={intl.formatMessage({
                    id: "EZQEUW",
                    defaultMessage: "Edit image",
                    description: "media tile edit button label",
                  })}
                  data-test-id="product-media-edit"
                >
                  <Pencil size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
                </Link>
              ) : null}
              {onDelete !== undefined ? (
                <button
                  type="button"
                  className={styles.controlButton}
                  onClick={onDelete}
                  aria-label={intl.formatMessage({
                    id: "fzk04H",
                    defaultMessage: "Delete image",
                    description: "dialog title",
                  })}
                  data-test-id="product-media-delete"
                >
                  <Trash2 size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
                </button>
              ) : null}
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
};

MediaTile.displayName = "MediaTile";
