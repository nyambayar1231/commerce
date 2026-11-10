// Adapted from saleor-dashboard: src/components/ConditionalFilter/FilterElement/ConditionValue.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The right-hand value of a condition. Saleor's attribute extras (entity and swatch data on
// ItemOption) are dropped: our values come straight from the URL as strings.

export interface ItemOption {
  label: string;
  value: string;
  slug: string;
}

export type ConditionValue = ItemOption | ItemOption[] | string | string[] | [string, string];

export const isItemOption = (x: unknown): x is ItemOption =>
  typeof x === "object" && x !== null && "value" in x;

export const isItemOptionArray = (x: unknown): x is ItemOption[] =>
  Array.isArray(x) && x.every(isItemOption);

export const isTuple = (x: unknown): x is [string, string] =>
  Array.isArray(x) && x.length === 2 && x.every((y) => typeof y === "string");

/** The value stored in a conditional-filter URL token: strings, or one slug per option. */
export const slugFromConditionValue = (rawEntry?: ConditionValue): string | string[] => {
  if (typeof rawEntry === "string") {
    return rawEntry;
  }

  if (Array.isArray(rawEntry)) {
    return rawEntry.map((el) => (typeof el === "string" ? el : el.slug));
  }

  return rawEntry?.slug ?? "";
};
