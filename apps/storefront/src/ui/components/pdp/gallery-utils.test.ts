import { describe, expect, it } from "vitest";
import type { ProductView, VariantView } from "@/lib/catalog/types";
import { getGalleryImages, resolveSelectedVariant, variantParam } from "./gallery-utils";

// The PDP's variant selection rules (M4.3): a single variant is always selected; with several,
// only an exact `?variant=` id match selects one; a selected variant's own media comes first
// in the gallery.

function variant(id: string, overrides: Partial<VariantView> = {}): VariantView {
  return {
    id,
    name: `Хувилбар ${id}`,
    sku: null,
    price: "₮\u00a025,000",
    priceAmount: 25000,
    stock: "inStock",
    quantity: null,
    mediaIds: [],
    ...overrides,
  };
}

function product(variants: VariantView[], images: string[]): ProductView {
  return {
    id: "p1",
    name: "Ноолуур шарф",
    slug: "nooluur-sharf",
    url: "/products/nooluur-sharf",
    description: [],
    descriptionText: "",
    breadcrumbs: [],
    images: images.map((id) => ({
      id,
      alt: "Ноолуур шарф",
      thumb: `https://img/${id}/128.webp`,
      src: `https://img/${id}/1024.webp`,
      srcSet: `https://img/${id}/1024.webp 1024w, https://img/${id}/2048.webp 2048w`,
      large: `https://img/${id}/2048.webp`,
    })),
    variants,
    priceRange: { min: "₮\u00a025,000", max: null },
  };
}

describe("variantParam", () => {
  it("reads the param, taking the first value when repeated", () => {
    expect(variantParam({ variant: "v1" })).toBe("v1");
    expect(variantParam({ variant: ["v1", "v2"] })).toBe("v1");
  });

  it("treats a missing or empty param as no selection", () => {
    expect(variantParam({})).toBeUndefined();
    expect(variantParam({ variant: undefined })).toBeUndefined();
    expect(variantParam({ variant: "" })).toBeUndefined();
  });
});

describe("resolveSelectedVariant", () => {
  it("always selects the only variant, whatever the param says", () => {
    const single = product([variant("v1")], ["m1"]);
    expect(resolveSelectedVariant(single, undefined)?.id).toBe("v1");
    expect(resolveSelectedVariant(single, "v1")?.id).toBe("v1");
    expect(resolveSelectedVariant(single, "garbage")?.id).toBe("v1");
  });

  it("selects the matching variant among several", () => {
    const multi = product([variant("v1"), variant("v2")], ["m1"]);
    expect(resolveSelectedVariant(multi, "v2")?.id).toBe("v2");
  });

  it("selects nothing for a missing or unknown id", () => {
    const multi = product([variant("v1"), variant("v2")], ["m1"]);
    expect(resolveSelectedVariant(multi, undefined)).toBeNull();
    expect(resolveSelectedVariant(multi, "garbage")).toBeNull();
  });
});

describe("getGalleryImages", () => {
  it("keeps the product's order without a selection", () => {
    const view = product([variant("v1"), variant("v2")], ["m1", "m2", "m3"]);
    expect(getGalleryImages(view, null).map((image) => image.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("puts the selected variant's media first, the rest after them", () => {
    const withMedia = variant("v2", { mediaIds: ["m3", "m1"] });
    const view = product([variant("v1"), withMedia], ["m1", "m2", "m3"]);
    expect(getGalleryImages(view, withMedia).map((image) => image.id)).toEqual(["m1", "m3", "m2"]);
  });

  it("keeps the default order when the selected variant has no media of its own", () => {
    const unknownMedia = variant("v1", { mediaIds: ["missing"] });
    const view = product([unknownMedia, variant("v2")], ["m1", "m2"]);
    expect(getGalleryImages(view, unknownMedia).map((image) => image.id)).toEqual(["m1", "m2"]);
    const noMedia = variant("v1", { mediaIds: [] });
    const empty = product([noMedia, variant("v2")], ["m1", "m2"]);
    expect(getGalleryImages(empty, noMedia).map((image) => image.id)).toEqual(["m1", "m2"]);
  });
});
