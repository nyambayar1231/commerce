import { describe, expect, it } from "vitest";

import { validateProductMediaFiles } from "./validateProductMediaFiles";

const file = (name: string, type: string) => new File(["bytes"], name, { type });

describe("validateProductMediaFiles", () => {
  it("keeps images by MIME type", () => {
    const png = file("shoe.png", "image/png");
    const webp = file("photo", "image/webp");

    expect(validateProductMediaFiles([png, webp])).toEqual({
      validFiles: [png, webp],
      rejected: [],
    });
  });

  it("falls back to the file extension when the browser sends no MIME type", () => {
    const jpeg = file("photo.JPG", "");

    expect(validateProductMediaFiles([jpeg]).validFiles).toEqual([jpeg]);
  });

  it("rejects files that are not images", () => {
    const pdf = file("manual.pdf", "application/pdf");
    const png = file("shoe.png", "image/png");

    expect(validateProductMediaFiles([pdf, png])).toEqual({
      validFiles: [png],
      rejected: [{ file: pdf, reason: "invalidType" }],
    });
  });
});
