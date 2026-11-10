// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/errors.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { FilterError } from "./types";

export type ErrorLookup = Record<
  number,
  {
    left: { text: string; show: boolean };
    right: { text: string; show: boolean };
    condition: { text: string; show: boolean };
  }
>;

export const createErrorLookup = (errors: FilterError[] | undefined): ErrorLookup => {
  const entries = errors?.map((error) => [
    error.row,
    {
      left: { text: error.leftText ?? "", show: !!error.leftText },
      right: { text: error.rightText ?? "", show: !!error.rightText },
      condition: { text: error.conditionText ?? "", show: !!error.conditionText },
    },
  ]);

  return entries ? Object.fromEntries(entries) : {};
};

export const getErrorByRowIndex = (errorLookup: ErrorLookup, rowIndex: number) =>
  errorLookup[rowIndex] ?? {
    left: { text: "", show: false },
    right: { text: "", show: false },
    condition: { text: "", show: false },
  };
