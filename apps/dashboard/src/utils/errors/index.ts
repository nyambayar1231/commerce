// Adapted from saleor-dashboard: src/utils/errors/index.ts, src/utils/errors/common.ts and
// src/utils/errors/product.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Only the codes our API returns (ProductErrorCode: GRAPHQL_ERROR, INVALID, NOT_FOUND, REQUIRED,
// UNIQUE); Saleor's product-specific cases (attributes, SKU, price…) come with products.
import { defineMessages, type IntlShape } from "react-intl";

import type { ProductErrorFragment } from "../../graphql/types.generated";
import { commonMessages } from "../../intl";

export const commonErrorMessages = defineMessages({
  graphqlError: {
    id: "c5pMZ8",
    defaultMessage: "API error",
  },
  invalid: {
    id: "577R2r",
    defaultMessage: "Invalid value",
  },
  unknownError: {
    id: "qDwvZ4",
    defaultMessage: "Unknown error",
  },
});

interface UserError {
  field: string | null;
}

export type FormErrors<TField extends string, TError extends UserError> = Record<
  TField,
  TError | undefined
>;

export function getFieldError<T extends UserError>(errors: T[], field: string): T | undefined {
  return errors.find((err) => err.field === field);
}

export function getFormErrors<TField extends string, TError extends UserError>(
  fields: TField[],
  errors: TError[] = [],
): FormErrors<TField, TError> {
  return fields.reduce(
    (errs, field) => {
      errs[field] = getFieldError(errors, field);

      return errs;
    },
    {} as Record<TField, TError | undefined>,
  );
}

// Any API error with a code and message (product, order…); only its code is switched on.
type ProductErrorLike = Pick<ProductErrorFragment, "message"> & { code: string };

export function getCommonFormFieldErrorMessage(
  error: ProductErrorLike | undefined,
  intl: IntlShape,
): string | undefined {
  if (error) {
    switch (error.code) {
      case "GRAPHQL_ERROR":
        return intl.formatMessage(commonErrorMessages.graphqlError);
      case "REQUIRED":
        return intl.formatMessage(commonMessages.requiredField);
      case "INVALID":
        // Prefer the API message when present — "Invalid value" alone is not actionable.
        return error.message || intl.formatMessage(commonErrorMessages.invalid);
      default:
        if (error.message) {
          return error.message;
        }

        return intl.formatMessage(commonErrorMessages.unknownError);
    }
  }

  return undefined;
}

/** Saleor's getProductErrorMessage: a product INVALID error reads "Invalid value". */
export function getProductErrorMessage(
  err: ProductErrorLike | undefined,
  intl: IntlShape,
): string | undefined {
  if (err?.code === "INVALID") {
    return intl.formatMessage(commonErrorMessages.invalid);
  }

  return getCommonFormFieldErrorMessage(err, intl);
}

// Adapted from saleor-dashboard: src/utils/errors/order.ts (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce). Saleor's messages for the OrderErrorCode values our order actions return;
// the rest fall back to the common messages (the API's own message first).
const orderErrorMessages = defineMessages({
  cannotCancelOrder: {
    id: "BM1JiJ",
    defaultMessage: "This order cannot be cancelled",
    description: "error message",
  },
  cannotFulfillLine: {
    id: "nOo0oL",
    defaultMessage: "Not enough items to fulfill",
    description: "error message",
  },
  insufficientStock: {
    id: "d9UqaJ",
    defaultMessage: "Cannot change the quantity because of insufficient stock",
    description: "error message",
  },
  noZeroValue: {
    defaultMessage: "Ensure this value is greater than 0.",
    id: "YzLUXA",
  },
});

export function getOrderErrorMessage(
  err: ProductErrorLike | undefined,
  intl: IntlShape,
): string | undefined {
  switch (err?.code) {
    case "CANNOT_CANCEL_ORDER":
      return intl.formatMessage(orderErrorMessages.cannotCancelOrder);
    case "FULFILL_ORDER_LINE":
      return intl.formatMessage(orderErrorMessages.cannotFulfillLine);
    case "INSUFFICIENT_STOCK":
      return intl.formatMessage(orderErrorMessages.insufficientStock);
    case "ZERO_QUANTITY":
      return intl.formatMessage(orderErrorMessages.noZeroValue);
    default:
      return getCommonFormFieldErrorMessage(err, intl);
  }
}
