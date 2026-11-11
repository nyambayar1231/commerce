// Adapted from saleor-dashboard: src/components/ConditionalFilter/constants.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Product and order left operands and their conditions, reduced to the fields our
// `ProductWhereInput` and `OrderWhereInput` can answer (orders: status only, owner decision 3 of
// M6). Saleor's other lists (vouchers, pages…) and the attribute machinery are dropped.
import type { OrderStatus } from "../../graphql/types.generated";

export interface LeftOperand {
  value: string;
  label: string;
  type: string;
  slug: string;
  maxOccurrences?: number;
}

/** Saleor's conditions per left operand: [type, label, input id]. */
export const STATIC_CONDITIONS = {
  category: [
    { type: "combobox", label: "is", value: "input-1" },
    { type: "multiselect", label: "in", value: "input-2" },
  ],
  price: [
    { type: "number", label: "is", value: "input-1" },
    { type: "number", label: "lower", value: "input-2" },
    { type: "number", label: "greater", value: "input-3" },
    { type: "number.range", label: "between", value: "input-4" },
  ],
  isPublished: [{ type: "select", label: "is", value: "input-1" }],
  hasCategory: [{ type: "select", label: "is", value: "input-1" }],
  updatedAt: [
    { type: "datetime", label: "lower", value: "input-1" },
    { type: "datetime", label: "greater", value: "input-2" },
    { type: "datetime.range", label: "between", value: "input-3" },
  ],
  status: [
    { type: "combobox", label: "is", value: "input-1" },
    { type: "multiselect", label: "in", value: "input-2" },
  ],
};

export const STATIC_PRODUCT_OPTIONS: LeftOperand[] = [
  { value: "price", label: "Price", type: "price", slug: "price", maxOccurrences: 1 },
  { value: "category", label: "Category", type: "category", slug: "category", maxOccurrences: 1 },
  {
    value: "isPublished",
    label: "Is published",
    type: "isPublished",
    slug: "isPublished",
    maxOccurrences: 1,
  },
  {
    value: "hasCategory",
    label: "Has category",
    type: "hasCategory",
    slug: "hasCategory",
    maxOccurrences: 1,
  },
  {
    value: "updatedAt",
    label: "Updated at",
    type: "updatedAt",
    slug: "updatedAt",
    maxOccurrences: 1,
  },
];

export const STATIC_ORDER_OPTIONS: LeftOperand[] = [
  { value: "status", label: "Order Status", type: "status", slug: "status", maxOccurrences: 1 },
];

/** Every left operand a URL token may name (Saleor's STATIC_OPTIONS). */
export const STATIC_OPTIONS: LeftOperand[] = [...STATIC_PRODUCT_OPTIONS, ...STATIC_ORDER_OPTIONS];

/** Our OrderStatus values in Saleor's enum order: the status filter's options. */
export const ORDER_STATUSES: OrderStatus[] = [
  "UNFULFILLED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "CANCELED",
];
