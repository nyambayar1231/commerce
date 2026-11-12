import type { Db } from "@commerce/db";
import type { Plugin } from "graphql-yoga";
import { decodeGlobalId } from "./graphql/globalId.ts";
import { logger } from "./logger.ts";
import {
  getOrCreateThumbnail,
  getThumbnailSize,
  ImageTooLargeError,
  InvalidImageError,
  ProductMediaNotFoundError,
  parseThumbnailUrlFormat,
} from "./modules/catalog/index.ts";
import { getStorage, StorageObjectNotFoundError } from "./storage/index.ts";

// Saleor's on-demand thumbnail endpoint (saleor/thumbnail/views.py, ADR-0014):
// GET/HEAD /thumbnail/<ProductMedia global id>/<size>/[<format>/] answers 302 to the stored
// thumbnail, generating it first when it does not exist. It is anonymous, like Saleor, and runs
// before the CSRF plugin (app.ts), so an image URL works without the GraphQL CSRF header.

// Saleor's route regex (saleor/urls.py).
const THUMBNAIL_PATH = /^\/thumbnail\/([.0-9A-Za-z_=-]+)\/(\d+)\/(?:([a-zA-Z]+)\/)?$/;

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

/** The endpoint as a Yoga plugin; requests that are not a thumbnail GET/HEAD fall through. */
export function thumbnailRoute(db: Db): Plugin {
  return {
    async onRequest({ request, url, endResponse }) {
      if (request.method !== "GET" && request.method !== "HEAD") return;
      const match = THUMBNAIL_PATH.exec(url.pathname);
      if (match === null) return;

      const globalId = match[1] ?? "";
      const sizeText = match[2] ?? "0";
      const formatText = match[3];
      endResponse(await handleThumbnail(db, globalId, sizeText, formatText));
    },
  };
}

async function handleThumbnail(
  db: Db,
  globalId: string,
  sizeText: string,
  formatText: string | undefined,
): Promise<Response> {
  let type: string;
  let mediaId: string;
  try {
    ({ typename: type, id: mediaId } = decodeGlobalId(globalId));
  } catch {
    return textResponse("Cannot found instance with the given id.", 404);
  }
  if (type !== "ProductMedia") return textResponse("Invalid instance type.", 404);

  const format = parseThumbnailUrlFormat(formatText ?? null);
  if (format === null) return textResponse("Unsupported image format.", 404);

  const size = getThumbnailSize(Number(sizeText), "NEAREST");
  try {
    const storage = getStorage();
    const thumbnail = await getOrCreateThumbnail(db, storage, mediaId, size, format);
    return redirectResponse(storage.publicUrl(thumbnail.imageKey));
  } catch (error) {
    if (error instanceof ProductMediaNotFoundError) {
      return textResponse("Instance with the given id cannot be found.", 404);
    }
    if (error instanceof StorageObjectNotFoundError) {
      return textResponse("Cannot found image file.", 404);
    }
    if (error instanceof ImageTooLargeError) return textResponse("Image is too large.", 400);
    if (error instanceof InvalidImageError) return textResponse("Invalid image.", 400);

    logger.error({ err: error, id: globalId, size, format }, "Failed to create a thumbnail");
    return textResponse("Internal server error.", 500);
  }
}
