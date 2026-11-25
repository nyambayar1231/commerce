import { describe, expect, it } from "vitest";
import type { AccountAddressFragment, AccountOrderDetailFragment } from "@/gql/graphql";
import {
  orderStatusKey,
  orderTimeline,
  paymentStateKey,
  toAddressView,
  toOrderDetail,
  toOrderSummary,
} from "./mappers";

const gross = (amount: number) => ({ gross: { amount, currency: "MNT" } });

const address: AccountAddressFragment = {
  id: "QWRkcmVzczox",
  firstName: "Бат",
  lastName: "Болд",
  companyName: "",
  streetAddress1: "Энхтайваны өргөн чөлөө 5",
  streetAddress2: "",
  city: "Сүхбаатар дүүрэг",
  cityArea: "1-р хороо",
  postalCode: "",
  countryArea: "Улаанбаатар",
  phone: null,
  country: { code: "MN", country: "Монгол" },
  isDefaultShippingAddress: true,
  isDefaultBillingAddress: null,
};

const order: AccountOrderDetailFragment = {
  id: "T3JkZXI6MQ==",
  number: "1042",
  created: "2026-11-20T02:00:00Z",
  updatedAt: "2026-11-23T05:00:00Z",
  status: "PARTIALLY_FULFILLED",
  chargeStatus: "FULL",
  shippingMethodName: " Хүргэлт ",
  lines: [
    {
      id: "l1",
      productName: "Цүнх",
      variantName: "Улаан",
      quantity: 2,
      unitPrice: gross(15000),
      totalPrice: gross(30000),
    },
    {
      id: "l2",
      productName: "Малгай",
      variantName: "",
      quantity: 1,
      unitPrice: gross(9000),
      totalPrice: gross(9000),
    },
  ],
  subtotal: gross(39000),
  shippingPrice: gross(5000),
  total: gross(44000),
  shippingAddress: address,
  billingAddress: null,
  fulfillments: [
    {
      id: "f1",
      created: "2026-11-21T03:00:00Z",
      status: "FULFILLED",
      trackingNumber: "TRK-1",
      lines: [{ quantity: 2 }],
    },
    {
      id: "f2",
      created: "2026-11-22T03:00:00Z",
      status: "CANCELED",
      trackingNumber: "",
      lines: [{ quantity: 1 }],
    },
  ],
};

describe("orderStatusKey", () => {
  it.each(["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELED"])("keeps %s", (status) => {
    expect(orderStatusKey(status)).toBe(status);
  });
  it("reads anything else as unfulfilled", () => {
    expect(orderStatusKey("DRAFT")).toBe("UNFULFILLED");
    expect(orderStatusKey("SOMETHING_NEW")).toBe("UNFULFILLED");
  });
});

describe("paymentStateKey", () => {
  it("maps the charge status", () => {
    expect(paymentStateKey("NONE")).toBe("none");
    expect(paymentStateKey("PARTIAL")).toBe("partial");
    expect(paymentStateKey("FULL")).toBe("full");
    expect(paymentStateKey("OVERCHARGED")).toBe("overcharged");
  });
});

describe("toOrderSummary", () => {
  it("formats money and the date on the server and counts items", () => {
    expect(toOrderSummary(order)).toEqual({
      id: "T3JkZXI6MQ==",
      number: "1042",
      createdIso: "2026-11-20T02:00:00Z",
      createdLabel: expect.stringContaining("20"),
      status: "PARTIALLY_FULFILLED",
      total: "₮ 44,000",
      itemCount: 3,
    });
  });
});

describe("orderTimeline", () => {
  it("lists placed and each shipped fulfillment, newest first, skipping cancelled ones", () => {
    const entries = orderTimeline(order);
    expect(entries.map((entry) => entry.kind)).toEqual(["fulfilled", "placed"]);
    expect(entries[0]).toMatchObject({ kind: "fulfilled", itemCount: 2, trackingNumber: "TRK-1" });
  });

  it("adds the cancellation with the order's last update, newest first", () => {
    const entries = orderTimeline({ ...order, status: "CANCELED", fulfillments: [] });
    expect(entries.map((entry) => entry.kind)).toEqual(["canceled", "placed"]);
    expect(entries[0]?.iso).toBe("2026-11-23T05:00:00Z");
  });

  it("an order just placed has only the placed entry", () => {
    expect(orderTimeline({ ...order, status: "UNFULFILLED", fulfillments: [] })).toHaveLength(1);
  });
});

describe("toOrderDetail", () => {
  it("maps lines, totals, addresses and the shipping method", () => {
    const view = toOrderDetail(order);
    expect(view.paymentState).toBe("full");
    expect(view.lines[0]).toMatchObject({ unitPrice: "₮ 15,000", totalPrice: "₮ 30,000" });
    expect(view.subtotal).toBe("₮ 39,000");
    expect(view.shipping).toBe("₮ 5,000");
    expect(view.shippingMethod).toBe("Хүргэлт");
    expect(view.shippingAddress?.countryName).toBe("Монгол");
    expect(view.billingAddress).toBeNull();
  });

  it("a missing shipping method name is null", () => {
    expect(toOrderDetail({ ...order, shippingMethodName: null }).shippingMethod).toBeNull();
  });
});

describe("toAddressView", () => {
  it("flattens the country and turns null flags and phone into false and empty", () => {
    expect(toAddressView(address)).toMatchObject({
      countryCode: "MN",
      countryName: "Монгол",
      phone: "",
      isDefaultShipping: true,
      isDefaultBilling: false,
    });
  });
});
