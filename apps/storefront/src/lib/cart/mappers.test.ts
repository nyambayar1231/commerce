import { describe, expect, it } from "vitest";
import type { CartFragment } from "@/gql/graphql";
import { toCartView } from "./mappers";

type Line = CartFragment["lines"][number];

function line(overrides: Partial<Line> = {}): Line {
  return {
    id: "line-1",
    quantity: 2,
    variant: {
      id: "variant/1+",
      name: "42",
      quantityAvailable: 13,
      product: { name: "Demo Boots", slug: "demo-boots", thumbnail: null },
    },
    unitPrice: { gross: { amount: 25000, currency: "MNT" } },
    totalPrice: { gross: { amount: 50000, currency: "MNT" } },
    ...overrides,
  };
}

function checkout(lines: Line[]): CartFragment {
  return {
    id: "c1",
    token: "5b0c7f0e-1111-4222-8333-944455556666",
    quantity: lines.reduce((sum, item) => sum + item.quantity, 0),
    isShippingRequired: true,
    lines,
    subtotalPrice: { gross: { amount: 75000, currency: "MNT" } },
  };
}

describe("toCartView", () => {
  it("formats money on the server and sums the quantities", () => {
    const cart = toCartView(checkout([line(), line({ id: "line-2", quantity: 1 })]));
    expect(cart.quantity).toBe(3);
    expect(cart.subtotal).toBe("₮ 75,000");
    expect(cart.lines[0]).toMatchObject({
      id: "line-1",
      productName: "Demo Boots",
      variantName: "42",
      quantity: 2,
      unitPrice: "₮ 25,000",
      totalPrice: "₮ 50,000",
    });
  });

  it("links to the product with the variant selected (id URL-encoded)", () => {
    expect(toCartView(checkout([line()])).lines[0]?.href).toBe(
      "/products/demo-boots?variant=variant%2F1%2B",
    );
  });

  it("takes maxQuantity from quantityAvailable; untracked stock has none", () => {
    expect(toCartView(checkout([line()])).lines[0]?.maxQuantity).toBe(13);
    const untracked = line({
      variant: {
        id: "v",
        name: "e",
        quantityAvailable: null,
        product: { name: "A", slug: "a", thumbnail: null },
      },
    });
    expect(toCartView(checkout([untracked])).lines[0]?.maxQuantity).toBeNull();
  });

  it("maps the thumbnail, falling back to the product name for alt", () => {
    const withImage = line({
      variant: {
        id: "v",
        name: "e",
        quantityAvailable: null,
        product: {
          name: "Demo Boots",
          slug: "demo-boots",
          thumbnail: { url: "https://img/256.webp", alt: null },
        },
      },
    });
    expect(toCartView(checkout([withImage])).lines[0]?.image).toEqual({
      src: "https://img/256.webp",
      srcSet: "https://img/256.webp 256w",
      alt: "Demo Boots",
    });
    expect(toCartView(checkout([line()])).lines[0]?.image).toBeNull();
  });

  it("maps an empty checkout", () => {
    expect(
      toCartView({ ...checkout([]), subtotalPrice: { gross: { amount: 0, currency: "MNT" } } }),
    ).toMatchObject({
      quantity: 0,
      lines: [],
    });
  });
});
