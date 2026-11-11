// Adapted from saleor-dashboard: src/products/components/ProductMedia/ProductMedia.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's Media card, reduced to images and single delete (owner, M2.5.3a): the Upload button
// opens the file picker, files can be dropped on the card, each upload shows a pending tile with
// its local object URL until the saved media arrives, tiles can be dragged to reorder and each
// saved tile links to its image page. No external "Upload URL" menu, selection checkboxes or bulk
// delete.
import type { FetchResult } from "@apollo/client";
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, type SortingStrategy } from "@dnd-kit/sortable";
import { Box, Button, Skeleton, Text } from "@saleor/macaw-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FormattedMessage, useIntl } from "react-intl";

import cardStyles from "../../../components/DetailSettingsCard/DetailSettingsCard.module.css";
import { Draggable } from "../../../components/Draggable/Draggable";
import { MediaTile } from "../../../components/MediaTile/MediaTile";
import type {
  ProductMediaCreateMutation,
  ProductMediaFragment,
} from "../../../graphql/types.generated";
import { useNotifier } from "../../../hooks/useNotifier/useNotifier";
import createMultiFileUploadHandler from "../../../utils/handlers/multiFileUploadHandler";
import { messages, uploadRejectedMessage } from "./messages";
import styles from "./ProductMedia.module.css";
import { ProductMediaGalleryDropzone } from "./ProductMediaGalleryDropzone";
import { type ReorderEvent, useProductMediaDrag } from "./useProductMediaDrag";
import { validateProductMediaFiles } from "./validateProductMediaFiles";

const UPLOAD_CONCURRENCY = 3;

// Stable identity for the "not loaded yet" case: an inline `media ?? []` would hand the drag hook
// a new array on every render, and its media-sync effect would set state forever.
const NO_MEDIA: ProductMediaFragment[] = [];

export interface ImagesUploadCompleteResult {
  successCount: number;
  failureCount: number;
}

// Flex-wrap galleries cannot use rectSortingStrategy: transforms fight the reflow and animate
// items in from the left on drop (Saleor's same workaround, dnd-kit issue #44).
const disableSortingStrategy: SortingStrategy = () => null;

interface ProductMediaProps {
  /** Undefined until the product query resolves; the card shows a skeleton meanwhile. */
  media: ProductMediaFragment[] | undefined;
  onImageUpload: (file: File) => Promise<FetchResult<ProductMediaCreateMutation>>;
  onImagesUploadComplete?: (result: ImagesUploadCompleteResult) => void;
  onImageDelete: (id: string) => () => void;
  /** The image detail page's URL for a saved media; pending uploads have no page yet. */
  getImageEditHref?: (id: string) => string;
  onImageReorder?: (event: ReorderEvent) => void;
}

let pendingMediaIdCounter = 0;

const createPendingMedia = (file: File, sortOrder: number): ProductMediaFragment => {
  pendingMediaIdCounter += 1;

  return {
    __typename: "ProductMedia",
    alt: "",
    id: `pending-${Date.now()}-${pendingMediaIdCounter}`,
    sortOrder,
    type: "IMAGE",
    url: URL.createObjectURL(file),
    oembedData: {},
  };
};

export const ProductMedia = ({
  media,
  onImageUpload,
  onImagesUploadComplete,
  onImageDelete,
  getImageEditHref,
  onImageReorder,
}: ProductMediaProps) => {
  const intl = useIntl();
  const notify = useNotifier();
  const imagesUpload = useRef<HTMLInputElement>(null);
  const [pendingMedia, setPendingMedia] = useState<ProductMediaFragment[]>([]);
  /** Pending client ids → the media id the mutation returned. */
  const [pendingHandoffs, setPendingHandoffs] = useState<Record<string, string>>({});
  const pendingMediaRef = useRef(pendingMedia);

  pendingMediaRef.current = pendingMedia;

  const isUploading = pendingMedia.length > 0;
  const {
    orderedMedia,
    activeMedia,
    items,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useProductMediaDrag({
    media: media ?? NO_MEDIA,
    onReorder: onImageReorder,
    disabled: isUploading,
  });

  // Hand a pending tile off to its saved media as soon as the query result contains it. The local
  // object URL is no longer needed then (the tile shows the 1024 thumbnail); revoke it.
  useEffect(() => {
    if (media === undefined) {
      return;
    }

    const serverIds = new Set(media.map((item) => item.id));
    const handedOff = pendingMedia.filter((item) => {
      const serverId = pendingHandoffs[item.id];

      return serverId !== undefined && serverIds.has(serverId);
    });

    if (handedOff.length === 0) {
      return;
    }

    for (const item of handedOff) {
      URL.revokeObjectURL(item.url);
    }

    setPendingMedia((current) => current.filter((item) => !handedOff.includes(item)));
    setPendingHandoffs((current) => {
      const next = { ...current };

      for (const item of handedOff) {
        delete next[item.id];
      }

      return next;
    });
  }, [media, pendingHandoffs, pendingMedia]);

  // Revoke object URLs of tiles still pending when the page unmounts.
  useEffect(
    () => () => {
      for (const item of pendingMediaRef.current) {
        URL.revokeObjectURL(item.url);
      }
    },
    [],
  );

  const removePendingMedia = useCallback((clientId: string) => {
    setPendingMedia((current) => {
      const item = current.find((mediaItem) => mediaItem.id === clientId);

      if (item) {
        URL.revokeObjectURL(item.url);
      }

      return current.filter((mediaItem) => mediaItem.id !== clientId);
    });
    setPendingHandoffs((current) => {
      if (!(clientId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[clientId];

      return next;
    });
  }, []);

  const handleImageUpload = useCallback(
    (files: FileList | File[]) => {
      const { validFiles, rejected } = validateProductMediaFiles(files);

      if (rejected.length > 0) {
        notify({
          status: "warning",
          text: intl.formatMessage(uploadRejectedMessage, {
            count: rejected.length,
          }),
        });
      }

      if (validFiles.length === 0) {
        return;
      }

      const pendingItems = validFiles.map((file, index) => createPendingMedia(file, index));
      const clientIds = pendingItems.map((item) => item.id);
      let successCount = 0;
      let failureCount = 0;

      setPendingMedia((current) => [...current, ...pendingItems]);

      return createMultiFileUploadHandler(onImageUpload, {
        concurrency: UPLOAD_CONCURRENCY,
        onAfterUpload: (index, _files, result) => {
          successCount += 1;

          const serverId = result.data?.productMediaCreate.media?.id;

          if (serverId) {
            setPendingHandoffs((current) => ({
              ...current,
              [clientIds[index] as string]: serverId,
            }));
          }
        },
        onError: (index) => {
          failureCount += 1;
          removePendingMedia(clientIds[index] as string);
        },
        onCompleted: () => {
          onImagesUploadComplete?.({ successCount, failureCount });
        },
      })(validFiles);
    },
    [intl, notify, onImageUpload, onImagesUploadComplete, removePendingMedia],
  );

  const openFilePicker = () => {
    imagesUpload.current?.click();
  };

  const showGallery = (media?.length ?? 0) > 0 || pendingMedia.length > 0;

  return (
    <Box className={cardStyles.card} data-test-id="product-media">
      <Box className={[cardStyles.header, cardStyles.headerWithEnd].join(" ")}>
        <Box className={cardStyles.headerMain}>
          <Text size={5} fontWeight="bold" as="h2" className={cardStyles.title}>
            <FormattedMessage {...messages.media} />
          </Text>
        </Box>
        <Box className={cardStyles.headerEnd}>
          <Button
            variant="secondary"
            size="small"
            type="button"
            data-test-id="button-upload-image"
            onClick={openFilePicker}
          >
            {intl.formatMessage(messages.upload)}
          </Button>
        </Box>
      </Box>
      <Box className={cardStyles.content}>
        <input
          className={styles.hiddenInput}
          data-test-id="product-media-file-input"
          id="product-media-file-upload"
          onChange={(event) => {
            if (event.target.files) {
              void handleImageUpload(event.target.files);
            }

            // Allow selecting the same file again.
            event.target.value = "";
          }}
          multiple
          type="file"
          ref={imagesUpload}
          accept="image/*"
        />
        {media === undefined ? (
          <Box padding={5}>
            <Skeleton height={7} />
          </Box>
        ) : showGallery ? (
          <ProductMediaGalleryDropzone variant="gallery" onImageUpload={handleImageUpload}>
            {({ isDragActive }) => (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext items={items} strategy={disableSortingStrategy}>
                  <div
                    className={[styles.mediaList, isDragActive && styles.mediaListDimmed]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {orderedMedia.map((mediaObject) => (
                      <Draggable key={mediaObject.id} id={mediaObject.id} disabled={isUploading}>
                        {({ ref, style, isDragging, ...draggableProps }) => (
                          <div
                            ref={ref}
                            // Park the ghost in the list slot; DragOverlay follows the pointer.
                            style={
                              isDragging
                                ? { ...style, transform: undefined, transition: undefined }
                                : style
                            }
                            className={[
                              styles.sortableTile,
                              isDragging && styles.sortableTilePlaceholder,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            {...draggableProps}
                          >
                            <MediaTile
                              media={mediaObject}
                              editHref={getImageEditHref?.(mediaObject.id)}
                              onDelete={onImageDelete(mediaObject.id)}
                              disableOverlay={isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {pendingMedia.map((mediaObject) => (
                      <MediaTile loading key={mediaObject.id} media={mediaObject} />
                    ))}
                  </div>
                </SortableContext>
                {createPortal(
                  <DragOverlay dropAnimation={null} style={{ zIndex: 1000 }}>
                    {activeMedia ? (
                      <div className={styles.dragOverlayTile}>
                        <MediaTile media={activeMedia} disableOverlay />
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )}
              </DndContext>
            )}
          </ProductMediaGalleryDropzone>
        ) : (
          <ProductMediaGalleryDropzone
            variant="empty"
            onImageUpload={handleImageUpload}
            onOpenFilePicker={openFilePicker}
          />
        )}
      </Box>
    </Box>
  );
};

ProductMedia.displayName = "ProductMedia";
