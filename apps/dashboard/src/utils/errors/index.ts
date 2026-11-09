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

type ProductErrorLike = Pick<ProductErrorFragment, "code" | "message">;

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
