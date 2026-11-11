import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageFormat, MAX_IMAGE_BYTES, validateImageFile } from "./index.ts";

// The upload's file type comes from the first bytes only (ADR-0014), never from the filename or
// the part's content type; a full sharp decode then rejects truncated or corrupt images. No
// database or S3 here: these are the file checks on their own.

const canvas = () => sharp({ create: { width: 8, height: 8, channels: 3, background: "#ff0000" } });

const fixtures = {
  jpeg: () => canvas().jpeg().toBuffer(),
  png: () => canvas().png().toBuffer(),
  gif: () => canvas().gif().toBuffer(),
  webp: () => canvas().webp().toBuffer(),
  tiff: () => canvas().tiff().toBuffer(),
};

const upload = (bytes: Uint8Array, name = "image", type = "application/octet-stream") =>
  new File([new Uint8Array(bytes)], name, { type });

describe("detectImageFormat", () => {
  it.each([
    ["jpeg", "image/jpeg", "jpg"],
    ["png", "image/png", "png"],
    ["gif", "image/gif", "gif"],
    ["webp", "image/webp", "webp"],
  ] as const)("recognises %s from its magic bytes", async (format, contentType, ext) => {
    expect(detectImageFormat(await fixtures[format]())).toEqual({ contentType, ext });
  });

  it("recognises GIF87a as well as GIF89a", () => {
    expect(detectImageFormat(Buffer.from("GIF87a\x01\x00\x01\x00", "latin1"))).toEqual({
      contentType: "image/gif",
      ext: "gif",
    });
  });

  it("is null for a file that is not one of the four formats", () => {
    expect(detectImageFormat(Buffer.from("this is not an image"))).toBeNull();
    // RIFF, but an AVI rather than a WebP.
    expect(detectImageFormat(Buffer.from("RIFF\x00\x00\x00\x00AVI ", "latin1"))).toBeNull();
  });
});

describe("validateImageFile", () => {
  it.each(["jpeg", "png", "gif", "webp"] as const)(
    "accepts a %s image and keeps its bytes",
    async (format) => {
      const bytes = await fixtures[format]();

      const result = await validateImageFile(upload(bytes));

      if (!result.ok) throw new Error(result.error.message);
      expect(result.image.bytes).toEqual(new Uint8Array(bytes));
      expect(result.image.ext).toBe(format === "jpeg" ? "jpg" : format);
    },
  );

  it("trusts the bytes, not the file's name or declared type", async () => {
    const png = await fixtures.png();

    const result = await validateImageFile(upload(png, "photo.jpg", "image/jpeg"));

    if (!result.ok) throw new Error(result.error.message);
    expect(result.image.contentType).toBe("image/png");
  });

  it("rejects a file over 10 MiB without reading it", async () => {
    const result = await validateImageFile({
      size: MAX_IMAGE_BYTES + 1,
      arrayBuffer: () => {
        throw new Error("a file over the limit must not be read");
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        field: "image",
        code: "FILE_SIZE_LIMIT_EXCEEDED",
        message: "File size exceeds the maximum allowed size of 10MB.",
      },
    });
  });

  it("names an image format we do not accept as an unsupported MIME type", async () => {
    const result = await validateImageFile(upload(await fixtures.tiff(), "photo.png", "image/png"));

    expect(result).toMatchObject({
      ok: false,
      error: {
        field: "image",
        code: "UNSUPPORTED_MIME_TYPE",
        message:
          "File type not permitted. Contact your administrator or support team to enable " +
          "support for `image/tiff` file type.",
      },
    });
  });

  it("rejects a file whose bytes are not an image", async () => {
    const result = await validateImageFile(upload(Buffer.from("just some text"), "photo.jpg"));

    expect(result).toMatchObject({
      ok: false,
      error: { field: "image", code: "INVALID_FILE_TYPE", message: "Invalid file type." },
    });
  });

  it("rejects a truncated image whose signature matched", async () => {
    const jpeg = await fixtures.jpeg();
    const truncated = jpeg.subarray(0, Math.floor(jpeg.length / 2));

    const result = await validateImageFile(upload(truncated, "photo.jpg"));

    expect(result).toMatchObject({
      ok: false,
      error: { field: "image", code: "INVALID_FILE_TYPE", message: "Invalid file type." },
    });
  });
});
