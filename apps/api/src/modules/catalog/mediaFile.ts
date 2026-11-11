import sharp from "sharp";
import type { ProductMediaError } from "./media.ts";

// Upload validation for product media (ADR-0014): the file type comes from the first bytes only,
// never from the filename or the multipart part's content type, both of which the client
// controls. Saleor's messages (saleor/graphql/core/validators/file.py).

/** Saleor's `settings.MAX_IMAGE_FILE_SIZE`: 10 MB, as 10 * 1024 * 1024 bytes. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** The part of a WHATWG `File` an upload needs; Yoga's multipart parsing yields one. */
export interface UploadedFile {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** The image formats product media accepts, with the content type and extension we store. */
export type ImageFormat = {
  contentType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  ext: "jpg" | "png" | "gif" | "webp";
};

/** A validated image: its bytes, ready for `putObject`, and the type read from them. */
export type ImageFile = ImageFormat & { bytes: Uint8Array };

/** Saleor's message for a file over `MAX_IMAGE_BYTES` (`:.0f` of the limit in MiB). */
const TOO_LARGE_MESSAGE = `File size exceeds the maximum allowed size of ${
  MAX_IMAGE_BYTES / (1024 * 1024)
}MB.`;

/** Saleor's `clean_image_file` message for a file it cannot open. */
const INVALID_FILE_MESSAGE = "Invalid file type.";

/** The content type of a format sharp recognises but product media does not accept. */
const MIME_TYPES: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jp2: "image/jp2",
  jxl: "image/jxl",
  png: "image/png",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  webp: "image/webp",
};

const imageError = (code: ProductMediaError["code"], message: string): ProductMediaError => ({
  field: "image",
  code,
  message,
});

/** Whether `text` (ASCII) sits in `bytes` at `offset`. */
function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index++) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

/**
 * The image format of `bytes`, from its first bytes only: JPEG `FF D8 FF`, PNG's 8-byte signature,
 * GIF87a/GIF89a and WebP's `RIFF????WEBP`. Null for anything else.
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (asciiAt(bytes, 0, "\xff\xd8\xff")) return { contentType: "image/jpeg", ext: "jpg" };
  if (asciiAt(bytes, 0, "\x89PNG\r\n\x1a\n")) return { contentType: "image/png", ext: "png" };
  if (asciiAt(bytes, 0, "GIF87a") || asciiAt(bytes, 0, "GIF89a")) {
    return { contentType: "image/gif", ext: "gif" };
  }
  if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP")) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

/**
 * An image sharp knows but we do not accept (BMP, TIFF, HEIF, SVG, …) is an unsupported MIME type;
 * bytes sharp cannot identify at all are an invalid file type.
 */
async function unidentifiedFileError(bytes: Uint8Array): Promise<ProductMediaError> {
  let format: string | undefined;
  try {
    format = (await sharp(bytes).metadata()).format;
  } catch {
    // Not an image sharp can read: no format to name.
  }
  if (format === undefined) return imageError("INVALID_FILE_TYPE", INVALID_FILE_MESSAGE);

  const mimeType = MIME_TYPES[format] ?? `image/${format}`;
  return imageError(
    "UNSUPPORTED_MIME_TYPE",
    "File type not permitted. Contact your administrator or support team to enable support for " +
      `\`${mimeType}\` file type.`,
  );
}

/**
 * Validates an uploaded image the way ADR-0014 and Saleor's `clean_image_file` do: the size, then
 * the type from the first bytes, then a full decode. The decode rejects truncated or corrupt files;
 * sharp's default `limitInputPixels` is deliberately kept as the decompression-bomb guard.
 */
export async function validateImageFile(
  file: UploadedFile,
): Promise<{ ok: true; image: ImageFile } | { ok: false; error: ProductMediaError }> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: imageError("FILE_SIZE_LIMIT_EXCEEDED", TOO_LARGE_MESSAGE) };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectImageFormat(bytes);
  if (format === null) return { ok: false, error: await unidentifiedFileError(bytes) };

  try {
    await sharp(bytes).toBuffer();
  } catch {
    // A known signature but an undecodable body: a truncated or corrupt image.
    return { ok: false, error: imageError("INVALID_FILE_TYPE", INVALID_FILE_MESSAGE) };
  }
  return { ok: true, image: { ...format, bytes } };
}
