import { describe, expect, it } from "vitest";

import type { ProductErrorFragment } from "../../../graphql/types.generated";
import {
  getProductUpdateData,
  getProductUpdateFormErrors,
  type ProductUpdateFormData,
} from "./form";

const formData = (overrides: Partial<ProductUpdateFormData> = {}): ProductUpdateFormData => ({
  name: "  Winter boots  ",
  description: "Warm\n\nWaterproof",
  category: "Q2F0ZWdvcnk6MQ==",
  isPublished: true,
  ...overrides,
});

const productError = (overrides: Partial<ProductErrorFragment> = {}): ProductErrorFragment => ({
  __typename: "ProductError",
  code: "REQUIRED",
  field: "name",
  message: "This field is required.",
  ...overrides,
});

describe("product update form → productUpdate input", () => {
  it("trims the name, converts the description to EditorJS and keeps the category and publish flag", () => {
    expect(getProductUpdateData(formData())).toEqual({
      name: "Winter boots",
      description: {
        blocks: [
          { type: "paragraph", data: { text: "Warm" } },
          { type: "paragraph", data: { text: "Waterproof" } },
        ],
      },
      category: "Q2F0ZWdvcnk6MQ==",
      isPublished: true,
    });
  });

  it("sends null for a blank description and a cleared category", () => {
    expect(
      getProductUpdateData(formData({ description: "   ", category: null, isPublished: false })),
    ).toEqual({
      name: "Winter boots",
      description: null,
      category: null,
      isPublished: false,
    });
  });
});

describe("product update error → field mapping", () => {
  it("puts name, category and isPublished errors on their inputs", () => {
    const nameError = productError({ field: "name" });
    const categoryError = productError({
      field: "category",
      code: "PRODUCT_WITHOUT_CATEGORY",
      message: "You must select a category to be able to publish.",
    });
    const isPublishedError = productError({
      field: "isPublished",
      code: "PRODUCT_WITHOUT_VARIANTS",
      message: "You must add at least one variant to be able to publish.",
    });

    expect(getProductUpdateFormErrors([nameError, categoryError, isPublishedError])).toEqual({
      name: nameError,
      category: categoryError,
      isPublished: isPublishedError,
      other: [],
    });
  });

  it("reports null-field and unknown-field errors as notifications", () => {
    const nullFieldError = productError({
      field: null,
      code: "GRAPHQL_ERROR",
      message: "Something went wrong.",
    });
    const descriptionError = productError({
      field: "description",
      code: "INVALID",
      message: "Invalid description.",
    });

    const result = getProductUpdateFormErrors([nullFieldError, descriptionError]);

    expect(result.name).toBeUndefined();
    expect(result.category).toBeUndefined();
    expect(result.isPublished).toBeUndefined();
    expect(result.other).toEqual([nullFieldError, descriptionError]);
  });
});
