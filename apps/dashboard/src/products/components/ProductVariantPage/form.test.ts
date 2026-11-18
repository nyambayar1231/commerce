// @vitest-environment jsdom
import { act, render, renderHook } from "@testing-library/react";
import { type ChangeEvent, createElement, useLayoutEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  ProductErrorFragment,
  ProductVariantDetailsFragment,
} from "../../../graphql/types.generated";
import {
  getProductVariantCreateData,
  getProductVariantFormData,
  getProductVariantFormErrors,
  getProductVariantUpdateData,
  getStockDiff,
  type ProductVariantFormData,
  type ProductVariantStock,
  useProductVariantForm,
} from "./form";

const stock = (overrides: Partial<ProductVariantStock> = {}): ProductVariantStock => ({
  warehouseId: "w1",
  warehouseName: "Main warehouse",
  quantityAllocated: 2,
  quantity: "5",
  ...overrides,
});

const formData = (overrides: Partial<ProductVariantFormData> = {}): ProductVariantFormData => ({
  name: "  Size 39  ",
  sku: " BT-1 ",
  trackInventory: false,
  price: "15000",
  stocks: [],
  media: [],
  ...overrides,
});

const variantError = (overrides: Partial<ProductErrorFragment> = {}): ProductErrorFragment => ({
  __typename: "ProductError",
  code: "REQUIRED",
  field: "name",
  message: "This field is required.",
  ...overrides,
});

const variantWithStocks = (warehouseIds: string[]): ProductVariantDetailsFragment => ({
  __typename: "ProductVariant",
  id: "v1",
  name: "Size 39",
  sku: "BT-39",
  trackInventory: true,
  price: { __typename: "Money", amount: 15000, currency: "MNT" },
  media: [],
  stocks: warehouseIds.map((warehouseId, index) => ({
    __typename: "Stock",
    id: `stock-${index}`,
    quantity: 5,
    quantityAllocated: 2,
    warehouse: { __typename: "Warehouse", id: warehouseId, name: `Warehouse ${warehouseId}` },
  })),
  product: { __typename: "Product", id: "p1", name: "Boot", media: [], variants: [] },
});

const renderForm = (stocks: ProductVariantStock[] = []) => {
  const onSubmit = vi.fn(async () => []);
  const initial = formData({ stocks });

  const hook = renderHook(() => useProductVariantForm(initial, onSubmit, false, true));

  return { ...hook, onSubmit };
};

/** Just enough of an input event for the form's `change` handler. */
const inputEvent = (name: string, value: string): ChangeEvent<HTMLInputElement> =>
  ({ target: { name, value } }) as unknown as ChangeEvent<HTMLInputElement>;

/**
 * Mounts the hook and types into it from a layout effect, which runs before the mount's passive
 * effects: a keystroke arriving right after the page's first paint. It renders the typed name.
 */
const TypeOnMount = ({
  initial,
  onSubmit,
  value,
}: {
  initial: ProductVariantFormData;
  onSubmit: (data: ProductVariantFormData) => Promise<unknown[]>;
  value: string;
}) => {
  const form = useProductVariantForm(initial, onSubmit, false, true);
  const change = useRef(form.change);

  change.current = form.change;
  useLayoutEffect(() => {
    change.current(inputEvent("name", value));
  }, [value]);

  return createElement("span", null, form.data.name);
};

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

  it("adds the product and the stock rows to the create input", () => {
    expect(
      getProductVariantCreateData(
        "UHJvZHVjdDox",
        formData({ stocks: [stock(), stock({ warehouseId: "w2", quantity: "" })] }),
      ),
    ).toEqual({
      product: "UHJvZHVjdDox",
      name: "Size 39",
      sku: " BT-1 ",
      trackInventory: false,
      price: "15000",
      stocks: [
        { warehouse: "w1", quantity: 5 },
        { warehouse: "w2", quantity: 0 },
      ],
    });
  });
});

describe("product variant initial form data", () => {
  it("maps the variant's stocks, sorted by warehouse name", () => {
    const variant = variantWithStocks(["w2", "w1"]);

    expect(getProductVariantFormData(variant).stocks).toEqual([
      {
        warehouseId: "w1",
        warehouseName: "Warehouse w1",
        quantityAllocated: 2,
        quantity: "5",
      },
      {
        warehouseId: "w2",
        warehouseName: "Warehouse w2",
        quantityAllocated: 2,
        quantity: "5",
      },
    ]);
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

describe("stock diff", () => {
  it("creates a warehouse the variant has no stock row in", () => {
    expect(
      getStockDiff(variantWithStocks(["w1"]), [
        stock(),
        stock({ warehouseId: "w2", quantity: "0" }),
      ]),
    ).toEqual({
      addStocks: [{ warehouse: "w2", quantity: 0 }],
      updateStocks: [{ warehouse: "w1", quantity: 5 }],
      removeStocks: [],
    });
  });

  it("updates every kept row, not only the changed ones", () => {
    expect(
      getStockDiff(variantWithStocks(["w1", "w2"]), [
        stock(),
        stock({ warehouseId: "w2", quantity: "8" }),
      ]),
    ).toEqual({
      addStocks: [],
      updateStocks: [
        { warehouse: "w1", quantity: 5 },
        { warehouse: "w2", quantity: 8 },
      ],
      removeStocks: [],
    });
  });

  it("deletes the row of a warehouse removed from the form", () => {
    expect(getStockDiff(variantWithStocks(["w1", "w2"]), [stock()])).toEqual({
      addStocks: [],
      updateStocks: [{ warehouse: "w1", quantity: 5 }],
      removeStocks: ["w2"],
    });
  });

  it("updates rather than creates a removed warehouse that is added back", () => {
    expect(
      getStockDiff(variantWithStocks(["w1", "w2"]), [
        stock(),
        stock({ warehouseId: "w2", quantity: "0" }),
      ]),
    ).toEqual({
      addStocks: [],
      updateStocks: [
        { warehouse: "w1", quantity: 5 },
        { warehouse: "w2", quantity: 0 },
      ],
      removeStocks: [],
    });
  });

  it("sends an empty quantity as 0", () => {
    const diff = getStockDiff(variantWithStocks(["w1"]), [stock({ quantity: "" })]);

    expect(diff.updateStocks).toEqual([{ warehouse: "w1", quantity: 0 }]);
  });
});

describe("variant form syncs with the variant's values", () => {
  it("keeps a value typed right after mount", () => {
    const onSubmit = vi.fn(async () => []);
    const initial = formData({ name: "", stocks: [] });

    // Nothing typed before the mount's passive effects flush may be overwritten: the hook is
    // re-synced while rendering, not from an effect.
    const { container } = render(
      createElement(TypeOnMount, { initial, onSubmit, value: "One size" }),
    );

    expect(container.textContent).toBe("One size");
  });

  it("replaces the data when the initial data changes", () => {
    const onSubmit = vi.fn(async () => []);
    const { result, rerender } = renderHook(
      ({ initial }: { initial: ProductVariantFormData }) =>
        useProductVariantForm(initial, onSubmit, false, true),
      { initialProps: { initial: formData({ name: "" }) } },
    );

    act(() => result.current.change(inputEvent("name", "Typed")));
    expect(result.current.data.name).toBe("Typed");

    rerender({ initial: formData({ name: "Size 39" }) });

    expect(result.current.data.name).toBe("Size 39");
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});

describe("variant form stock handlers and unsaved changes", () => {
  it("accepts only digits or an empty quantity", () => {
    const { result } = renderForm([stock()]);

    act(() => result.current.changeStock("w1", "12"));
    expect(result.current.data.stocks[0]?.quantity).toBe("12");

    act(() => result.current.changeStock("w1", "1a"));
    expect(result.current.data.stocks[0]?.quantity).toBe("12");

    act(() => result.current.changeStock("w1", "-1"));
    expect(result.current.data.stocks[0]?.quantity).toBe("12");

    act(() => result.current.changeStock("w1", ""));
    expect(result.current.data.stocks[0]?.quantity).toBe("");
  });

  it("adds a row with quantity 0 and the variant's allocated quantity", () => {
    const { result } = renderForm([]);

    act(() => result.current.addStock("w1", "Main warehouse"));

    expect(result.current.data.stocks).toEqual([
      {
        warehouseId: "w1",
        warehouseName: "Main warehouse",
        quantityAllocated: 0,
        quantity: "0",
      },
    ]);
  });

  it("does not add the same warehouse twice", () => {
    const { result } = renderForm([stock()]);

    act(() => result.current.addStock("w1", "Main warehouse"));

    expect(result.current.data.stocks).toHaveLength(1);
  });

  it("removes a row by warehouse", () => {
    const { result } = renderForm([stock(), stock({ warehouseId: "w2" })]);

    act(() => result.current.removeStock("w1"));

    expect(result.current.data.stocks.map((row) => row.warehouseId)).toEqual(["w2"]);
  });

  it("counts stock edits as unsaved changes", () => {
    const { result } = renderForm([stock()]);

    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => result.current.changeStock("w1", "6"));
    expect(result.current.hasUnsavedChanges).toBe(true);

    act(() => result.current.changeStock("w1", "5"));
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => result.current.removeStock("w1"));
    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});

describe("variant form media", () => {
  it("starts from the variant's chosen media ids", () => {
    const variant = variantWithStocks([]);
    variant.media = [
      {
        __typename: "ProductMedia",
        id: "media-2",
        alt: "",
        sortOrder: 1,
        url: "u2",
        type: "IMAGE",
        oembedData: {},
      },
      {
        __typename: "ProductMedia",
        id: "media-1",
        alt: "",
        sortOrder: 0,
        url: "u1",
        type: "IMAGE",
        oembedData: {},
      },
    ];

    expect(getProductVariantFormData(variant).media).toEqual(["media-2", "media-1"]);
    expect(getProductVariantFormData(null).media).toEqual([]);
  });

  it("counts a media selection change as an unsaved change, in any order", () => {
    const onSubmit = vi.fn(async () => []);
    const initial = formData({ media: ["media-1"] });
    const { result } = renderHook(() => useProductVariantForm(initial, onSubmit, false, true));

    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => result.current.changeMedia(["media-1"]));
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => result.current.changeMedia(["media-1", "media-2"]));
    expect(result.current.data.media).toEqual(["media-1", "media-2"]);
    expect(result.current.hasUnsavedChanges).toBe(true);

    act(() => result.current.changeMedia(["media-1"]));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});
