import { describe, expect, it } from "vitest";

import { getProductMediaUpdateVariables } from "./ProductImage";

describe("getProductMediaUpdateVariables", () => {
  it("sends the form's alt text with the image's id", () => {
    expect(getProductMediaUpdateVariables("media-1", { alt: "A red hoodie" })).toEqual({
      id: "media-1",
      alt: "A red hoodie",
    });
  });

  it("sends an emptied alt text as ''", () => {
    expect(getProductMediaUpdateVariables("media-1", { alt: "" })).toEqual({
      id: "media-1",
      alt: "",
    });
  });
});
