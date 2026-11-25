import { describe, expect, it } from "vitest";
import type { CheckoutDetailsFragment, OrderByTokenQuery } from "@/gql/graphql";
import { toCheckoutView, toOrderConfirmation } from "./mappers";

const gross = (amount: number) => ({ gross: { amount, currency: "MNT" } });
const address = {
  id: "QWRkcmVzczox",
  firstName: "Бат",
  lastName: "Дорж",
  companyName: "",
  streetAddress1: "Сүхбаатар, 1-р хороо",
  streetAddress2: "",
  city: "Баянзүрх",
  cityArea: "1-р хороо",
  postalCode: "",
  countryArea: "Улаанбаатар",
  phone: "+97699112233",
  country: { code: "MN", country: "Монгол" },
  isDefaultShippingAddress: null,
  isDefaultBillingAddress: null,
};

function checkout(overrides: Partial<CheckoutDetailsFragment> = {}): CheckoutDetailsFragment {
  return {
    id: "Q2hlY2tvdXQ6MQ==",
    token: "5b0c7f0e-1111-4222-8333-944455556666",
    quantity: 3,
    isShippingRequired: true,
    lines: [
      {
        id: "line-1",
        quantity: 3,
        variant: {
          id: "variant-1",
          name: "L",
          quantityAvailable: null,
          product: { name: "Цамц", slug: "tsamts", thumbnail: null },
        },
        unitPrice: gross(10000),
        totalPrice: gross(30000),
      },
    ],
    subtotalPrice: gross(30000),
    email: " bat@example.com ",
    shippingAddress: address,
    billingAddress: null,
    delivery: { shippingMethod: { id: "method-1" } },
    shippingMethods: [
      {
        id: "method-1",
        name: "Хүргэлт",
        active: true,
        message: " 1-2 өдөр ",
        price: { amount: 5000, currency: "MNT" },
      },
      {
        id: "method-2",
        name: "Яаралтай",
        active: false,
        message: null,
        price: { amount: 9000, currency: "MNT" },
      },
    ],
    shippingPrice: gross(5000),
    totalPrice: gross(35000),
    totalBalance: { amount: -35000, currency: "MNT" },
    chargeStatus: "NONE",
    ...overrides,
  } as CheckoutDetailsFragment;
}

describe("toCheckoutView", () => {
  it("formats money on the server and keeps the lines of the cart", () => {
    const view = toCheckoutView(checkout());
    expect(view.subtotal).toMatch(/30[\s,. ]?000/);
    expect(view.total).toMatch(/35[\s,. ]?000/);
    expect(view.shipping).toMatch(/5[\s,. ]?000/);
    expect(view.lines).toHaveLength(1);
    expect(view.quantity).toBe(3);
    expect(view.token).toBe("5b0c7f0e-1111-4222-8333-944455556666");
  });

  it("trims the email and reports what the checkout already has", () => {
    const view = toCheckoutView(checkout());
    expect(view.email).toBe("bat@example.com");
    expect(view).toMatchObject({
      hasEmail: true,
      hasShippingAddress: true,
      hasDeliveryMethod: true,
      shippingMethodId: "method-1",
    });
    expect(view.shippingAddress?.countryCode).toBe("MN");
    expect(view.billingAddress).toBeNull();
  });

  it("reads a fresh checkout as having nothing yet", () => {
    const view = toCheckoutView(
      checkout({ email: null, shippingAddress: null, delivery: null, shippingMethods: [] }),
    );
    expect(view).toMatchObject({
      email: null,
      hasEmail: false,
      hasShippingAddress: false,
      hasDeliveryMethod: false,
      shippingMethodId: null,
      shippingMethods: [],
    });
    // A blank email is no email.
    expect(toCheckoutView(checkout({ email: "  " })).hasEmail).toBe(false);
  });

  it("maps the delivery methods: trimmed message, inactive ones kept", () => {
    const { shippingMethods } = toCheckoutView(checkout());
    expect(shippingMethods.map((m) => [m.id, m.active, m.message])).toEqual([
      ["method-1", true, "1-2 өдөр"],
      ["method-2", false, ""],
    ]);
  });
});

describe("toOrderConfirmation", () => {
  it("is the customer's order view plus the email it went to", () => {
    const order = {
      id: "T3JkZXI6MQ==",
      number: "1001",
      created: "2026-11-25T03:00:00.000Z",
      updatedAt: "2026-11-25T03:00:00.000Z",
      status: "UNFULFILLED",
      chargeStatus: "FULL",
      shippingMethodName: "Хүргэлт",
      lines: [
        {
          id: "ol-1",
          productName: "Цамц",
          variantName: "L",
          quantity: 3,
          unitPrice: gross(10000),
          totalPrice: gross(30000),
        },
      ],
      subtotal: gross(30000),
      shippingPrice: gross(5000),
      total: gross(35000),
      shippingAddress: address,
      billingAddress: address,
      fulfillments: [],
      userEmail: " bat@example.com ",
    } as NonNullable<OrderByTokenQuery["orderByToken"]>;
    const view = toOrderConfirmation(order);
    expect(view.email).toBe("bat@example.com");
    expect(view.order).toMatchObject({
      number: "1001",
      status: "UNFULFILLED",
      paymentState: "full",
      shippingMethod: "Хүргэлт",
      itemCount: 3,
    });
    expect(toOrderConfirmation({ ...order, userEmail: null }).email).toBe("");
  });
});
