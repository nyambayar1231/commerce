// Adapted from saleor-dashboard: src/components/ConditionalFilter/intl.ts and useTranslate.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The filter's visible words (PLAN M11.3). Field labels and condition names stay English inside
// the filter model, because the URL stores them ("s0.price" with condition "lower"); they are
// translated only where they are shown. Saleor translates some field labels (leftOperatorsMessages)
// and none of the condition names; we translate all of them, with Saleor's ids where it has the
// same text.
import { defineMessages, type IntlShape } from "react-intl";

export const leftOperatorsMessages = defineMessages({
  price: { id: "b1zuN9", defaultMessage: "Price" },
  category: { id: "ccXLVi", defaultMessage: "Category" },
  isPublished: { id: "mIRBuW", defaultMessage: "Is published" },
  hasCategory: { id: "QHDtwH", defaultMessage: "Has category" },
  updatedAt: { id: "f3F7r5", defaultMessage: "Updated at", description: "filter field label" },
  status: { id: "tGpTam", defaultMessage: "Order Status", description: "filter field label" },
});

export const conditionMessages = defineMessages({
  is: { id: "fXdkiI", defaultMessage: "is" },
  in: { id: "/wMahJ", defaultMessage: "in", description: "filter condition" },
  lower: { id: "L5IuDw", defaultMessage: "lower" },
  greater: { id: "PFnobO", defaultMessage: "greater" },
  between: { id: "BvGp1I", defaultMessage: "between" },
});

export const booleanMessages = defineMessages({
  yes: { id: "a5msuh", defaultMessage: "Yes" },
  no: { id: "oUWADl", defaultMessage: "No" },
});

export const rowMessages = defineMessages({
  removeCondition: {
    id: "IzkXXK",
    defaultMessage: "Remove condition",
    description: "filter row remove button label",
  },
});

// Validation/*.ts writes these English texts into the filter's error state; shown translated.
const validationMessages = defineMessages({
  tooLong: {
    id: "i61KzJ",
    defaultMessage: "The value is too long.",
    description: "filter value validation error",
  },
  mustBeHigher: {
    id: "CLy6Vn",
    defaultMessage: "The value must be higher",
    description: "filter value validation error",
  },
});

/** A validation error text in the dashboard language; unknown ones as given. */
export const translateValidation = (intl: IntlShape, text: string): string => {
  const message = Object.values(validationMessages).find((m) => m.defaultMessage === text);
  return message ? intl.formatMessage(message) : text;
};

/** A field's label in the dashboard language, by its value (`price`…); unknown ones as given. */
export const translateLeftOperand = (intl: IntlShape, value: string, label: string): string => {
  const message = leftOperatorsMessages[value as keyof typeof leftOperatorsMessages];
  return message ? intl.formatMessage(message) : label;
};

/** A condition's name (`is`, `lower`…) in the dashboard language; unknown ones as given. */
export const translateCondition = (intl: IntlShape, label: string): string => {
  const message = conditionMessages[label as keyof typeof conditionMessages];
  return message ? intl.formatMessage(message) : label;
};
