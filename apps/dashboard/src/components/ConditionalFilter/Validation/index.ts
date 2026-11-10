// Adapted from saleor-dashboard: src/components/ConditionalFilter/Validation/index.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Applies the field's validator to each row. Saleor's metadata validator is dropped.
import { type FilterContainer, FilterElement } from "../FilterElement/FilterElement";
import { validateFilterElementToBeNumeric } from "./numeric";

const VALIDATORS = {
  NUMERIC: validateFilterElementToBeNumeric,
  price: validateFilterElementToBeNumeric,
} as Record<string, ValidateFn>;

export interface ErrorEntry {
  row: number;
  leftText?: string;
  conditionText?: string;
  rightText?: string;
}

type RawValidateEntry = false | ErrorEntry;
type ValidateFn = (element: FilterElement, row: number) => RawValidateEntry;

const toValidated = (
  element: string | FilterElement | FilterContainer,
  index: number,
): RawValidateEntry => {
  if (!FilterElement.isFilterElement(element)) return false;

  const validateFn = VALIDATORS[element.value.value];

  return validateFn ? validateFn(element, index) : false;
};

const hasErrors = (element: RawValidateEntry): element is ErrorEntry => element !== false;

export class Validator {
  constructor(public container: FilterContainer) {}

  public isValid() {
    return !this.validate().some(hasErrors);
  }

  public getErrors() {
    return this.validate().filter(hasErrors);
  }

  private validate() {
    return this.container.map(toValidated);
  }
}
