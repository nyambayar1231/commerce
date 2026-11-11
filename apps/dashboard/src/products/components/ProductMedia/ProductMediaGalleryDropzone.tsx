// Adapted from saleor-dashboard: src/products/components/ProductMedia/ProductMediaGalleryDropzone.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's dropzone visuals with native drag events instead of react-dropzone (no extra
// dependency): the empty state is the whole dropzone, the gallery wraps the tiles and shows the
// "drag and drop to upload" overlay while files are over it. Drags that carry no files are ignored.
import { Text } from "@saleor/macaw-ui";
import { Image } from "lucide-react";
import { type DragEvent, type ReactNode, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";

import { iconStrokeWidthBySize } from "../../../components/icons";
import { messages } from "./messages";
import styles from "./ProductMedia.module.css";

interface ProductMediaGalleryDropzoneProps {
  onImageUpload: (files: FileList | File[]) => void;
  variant: "empty" | "gallery";
  /** The empty state opens the shared file input; the gallery has no click-to-upload. */
  onOpenFilePicker?: () => void;
  disabled?: boolean;
  children?: (props: { isDragActive: boolean }) => ReactNode;
}

const hasFiles = (event: DragEvent): boolean =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

export const ProductMediaGalleryDropzone = ({
  onImageUpload,
  variant,
  onOpenFilePicker,
  disabled = false,
  children,
}: ProductMediaGalleryDropzoneProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  // dragenter/dragleave fire for every child element; count them so leaving a tile doesn't
  // end the drag state.
  const dragDepth = useRef(0);

  const handleDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepth.current += 1;

    if (!disabled) {
      setIsDragActive(true);
    }
  };

  const handleDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    // Required for the drop event to fire.
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);

    if (dragDepth.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setIsDragActive(false);

    if (!disabled && event.dataTransfer.files.length > 0) {
      onImageUpload(event.dataTransfer.files);
    }
  };

  const dragHandlers = {
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  if (variant === "empty") {
    return (
      <button
        {...dragHandlers}
        className={[
          styles.dropzone,
          isDragActive && styles.dropzoneActive,
          disabled && styles.dropzoneDisabled,
        ]
          .filter(Boolean)
          .join(" ")}
        data-test-id="product-media-dropzone"
        type="button"
        disabled={disabled}
        onClick={onOpenFilePicker}
      >
        <div className={styles.dropzoneContent}>
          <Image
            className={styles.dropzoneIcon}
            size={28}
            strokeWidth={iconStrokeWidthBySize.large}
            aria-hidden
          />
          <Text size={2} color="default2">
            <FormattedMessage {...messages.uploadHint} />
          </Text>
        </div>
      </button>
    );
  }

  return (
    <div {...dragHandlers} className={styles.galleryContainer} data-test-id="product-media-gallery">
      {children?.({ isDragActive: disabled ? false : isDragActive })}
      {isDragActive && !disabled ? (
        <div className={styles.dropOverlayWrapper}>
          <div className={styles.dropOverlay}>
            <Text size={2} color="default2">
              <FormattedMessage {...messages.uploadHintDrop} />
            </Text>
          </div>
        </div>
      ) : null}
    </div>
  );
};
