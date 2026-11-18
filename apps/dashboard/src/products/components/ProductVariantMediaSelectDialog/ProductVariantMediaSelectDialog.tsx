// Adapted from saleor-dashboard:
// src/products/components/ProductVariantImageSelectDialog/ProductVariantMediaSelectDialog.tsx,
// its messages and its styles (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's "choose the variant's photos" dialog: the product's images as tiles, clicking one
// toggles it, Confirm hands the selection to the form and closes. Cancel and closing discard the
// changes. Confirm is disabled until the selection differs from the variant's saved photos.
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import { ConfirmButton } from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import type { ProductMediaFragment } from "../../../graphql/types.generated";
import { areMediaSelectionsEqual } from "../../utils/media";
import { messages, selectedCountMessage } from "./messages";
import styles from "./ProductVariantMediaSelectDialog.module.css";

interface ProductVariantMediaSelectDialogProps {
  media: ProductMediaFragment[] | undefined;
  /** The variant's saved selection (the form's `data.media`). */
  selectedMedia: string[];
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

export const ProductVariantMediaSelectDialog = ({
  media,
  selectedMedia: committedMedia,
  open,
  onClose,
  onConfirm,
}: ProductVariantMediaSelectDialogProps) => {
  const intl = useIntl();
  const [selectedMedia, setSelectedMedia] = useState<string[]>(committedMedia);

  // Every opening starts from the saved selection: Confirm applied the previous choice to the
  // form, and Cancel discards it.
  useEffect(() => {
    if (open) {
      setSelectedMedia(committedMedia);
    }
  }, [open, committedMedia]);

  const sortedMedia = [...(media ?? [])].sort(
    (previous, next) => (previous.sortOrder ?? 0) - (next.sortOrder ?? 0),
  );

  const hasSelectionChanges = !areMediaSelectionsEqual(selectedMedia, committedMedia);

  const toggleMedia = (id: string) => {
    setSelectedMedia((current) =>
      current.includes(id) ? current.filter((mediaId) => mediaId !== id) : [...current, id],
    );
  };

  const handleConfirm = () => {
    if (hasSelectionChanges) {
      onConfirm(selectedMedia);
    }

    onClose();
  };

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="picker">
        <DashboardModal.ContextHeader
          description={<FormattedMessage {...messages.subtitle} />}
          contextLabel={
            sortedMedia.length > 0 ? (
              <FormattedMessage
                {...selectedCountMessage}
                values={{ count: selectedMedia.length }}
              />
            ) : undefined
          }
        >
          <FormattedMessage {...messages.title} />
        </DashboardModal.ContextHeader>
        <DashboardModal.Body fill>
          <DashboardModal.Inset>
            {sortedMedia.length === 0 ? (
              <FormattedMessage {...messages.empty} />
            ) : (
              <div className={styles.grid}>
                {sortedMedia.map((mediaObject) => {
                  const isSelected = selectedMedia.includes(mediaObject.id);

                  return (
                    <button
                      type="button"
                      className={[styles.tile, isSelected && styles.tileSelected]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => toggleMedia(mediaObject.id)}
                      key={mediaObject.id}
                      data-test-id="variant-media-option"
                      aria-pressed={isSelected}
                    >
                      <img className={styles.image} src={mediaObject.url} alt={mediaObject.alt} />
                    </button>
                  );
                })}
              </div>
            )}
          </DashboardModal.Inset>
        </DashboardModal.Body>
        <DashboardModal.Actions>
          <BackButton onClick={onClose} />
          <ConfirmButton
            data-test-id="submit"
            disabled={!hasSelectionChanges}
            onClick={handleConfirm}
            transitionState="default"
          >
            {intl.formatMessage(messages.confirm)}
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};

ProductVariantMediaSelectDialog.displayName = "ProductVariantMediaSelectDialog";
