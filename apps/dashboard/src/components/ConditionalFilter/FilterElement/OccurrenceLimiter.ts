// Adapted from saleor-dashboard: src/components/ConditionalFilter/FilterElement/OccurrenceLimiter.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A field can appear at most `maxOccurrences` times; fields without it are unlimited.
import type { LeftOperand } from "../LeftOperandsProvider";
import { type FilterContainer, FilterElement } from "./FilterElement";

export class OccurrenceLimiter {
  constructor(
    public fieldName: string,
    public maxOccurrences: number,
  ) {}

  public static fromOperand(operand: LeftOperand): OccurrenceLimiter | null {
    if (operand.maxOccurrences === undefined) return null;

    return new OccurrenceLimiter(operand.value, operand.maxOccurrences);
  }

  private countOccurrences(container: FilterContainer): number {
    return container.filter((element) => {
      if (!FilterElement.isFilterElement(element)) return false;

      return element.value.value === this.fieldName;
    }).length;
  }

  private hasReachedLimit(container: FilterContainer): boolean {
    return this.countOccurrences(container) >= this.maxOccurrences;
  }

  public static filterAvailableOperands(
    operands: LeftOperand[],
    container: FilterContainer,
  ): LeftOperand[] {
    return operands.filter((operand) => {
      const limiter = OccurrenceLimiter.fromOperand(operand);

      if (!limiter) return true;

      return !limiter.hasReachedLimit(container);
    });
  }
}
