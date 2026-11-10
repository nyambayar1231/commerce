import { describe, expect, it } from "vitest";

import type { ProductErrorFragment } from "../../../graphql/types.generated";
import {
  getProductVariantCreateData,
  getProductVariantFormErrors,
  getProductVariantUpdateData,
  type ProductVariantFormData,
} from "./form";

const formData = (overrides: Partial<ProductVariantFormData> = {}): ProductVariantFormData => ({
  name: "  Size 39  ",
  sku: " BT-1 ",
  trackInventory: false,
  price: "15000",
  ...overrides,
});

const variantError = (overrides: Partial<ProductErrorFragment> = {}): ProductErrorFragment => ({
  __typename: "ProductError",
  code: "REQUIRED",
  field: "name",
  message: "This field is required.",
  ...overrides,
});

describe("product variant form → mutation input", () => {
  it("maps the edit form to `productVariantUpdate` and trims the name", () => {
    expect(getProductVariantUpdateData(formData())).toEqual({
      name: "Size 39",
      sku: " BT-1 ",
      trackInventory: false,
      price: "15000",
    });
  });

  it("sends an empty SKU as an empty string, which the API stores as NULL", () => {
    expect(getProductVariantUpdateData(formData({ sku: "" })).sku).toBe("");
  });

  it("adds the product to the create input", () => {
    expect(getProductVariantCreateData("UHJvZHVjdDox", formData())).toEqual({
      product: "UHJvZHVjdDox",
      name: "Size 39",
      sku: " BT-1 ",
      trackInventory: false,
      price: "15000",
    });
  });
});

describe("product variant error → field mapping", () => {
  it("puts name, SKU and price errors on their inputs", () => {
    const nameError = variantError({ field: "name" });
    const skuError = variantError({
      field: "sku",
      code: "UNIQUE",
      message: "Product variant with this SKU already exists.",
    });
    const priceError = variantError({
      field: "price",
      code: "INVALID",
      message: "Price cannot be negative.",
    });

    expect(getProductVariantFormErrors([nameError, skuError, priceError])).toEqual({
      name: nameError,
      sku: skuError,
      price: priceError,
      other: [],
    });
  });

  it("reports null-field and unknown-field errors as notifications", () => {
    const lastVariantError = variantError({
      field: null,
      code: "PRODUCT_WITHOUT_VARIANTS",
      message: "Cannot delete the last variant of a published product. Unpublish it first.",
    });
    const nameError = variantError({
      field: "name",
      code: "INVALID",
      message: "Invalid name.",
    });
    const unknownFieldError = variantError({ field: "trackInventory" });

    const result = getProductVariantFormErrors([nameError, lastVariantError, unknownFieldError]);

    expect(result.name).toBe(nameError);
    expect(result.sku).toBeUndefined();
    expect(result.price).toBeUndefined();
    expect(result.other).toEqual([lastVariantError, unknownFieldError]);
  });
});
