// Adapted from saleor-dashboard: src/products/components/ProductMedia/validateProductMediaFiles.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Client-side checks that do not depend on backend configuration. File size is intentionally not
// validated here: the API enforces its own limit and the dashboard doesn't know it (as Saleor).

type ProductMediaFileValidationReason = "invalidType";

export interface ProductMediaFileValidationResult {
  validFiles: File[];
  rejected: Array<{ file: File; reason: ProductMediaFileValidationReason }>;
}

const isImageFile = (file: File): boolean => {
  if (file.type.startsWith("image/")) {
    return true;
  }

  // Some browsers leave type empty for certain picks; fall back to extension.
  return /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(file.name);
};

export const validateProductMediaFiles = (
  files: FileList | File[],
): ProductMediaFileValidationResult => {
  const validFiles: File[] = [];
  const rejected: ProductMediaFileValidationResult["rejected"] = [];

  Array.from(files).forEach((file) => {
    if (!isImageFile(file)) {
      rejected.push({ file, reason: "invalidType" });

      return;
    }

    validFiles.push(file);
  });

  return { validFiles, rejected };
};
