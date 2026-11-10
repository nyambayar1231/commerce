// Adapted from saleor-dashboard: src/components/ConditionalFilter/FilterElement/ConditionOptions.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The conditions a left operand offers (category: is/in, price: is/lower/greater/between…).
// Saleor's attribute input types are dropped: we filter static product fields only.
import { STATIC_CONDITIONS } from "../constants";

export type StaticElementName = keyof typeof STATIC_CONDITIONS;

export interface ConditionItem {
  type: string;
  label: string;
  value: string;
}

export class ConditionOptions extends Array<ConditionItem> {
  private constructor(options: ConditionItem[] | number) {
    if (Array.isArray(options)) {
      super(...options);

      return;
    }

    super(options);
  }

  public static isStaticName(name: string): name is StaticElementName {
    return typeof name === "string" && name in STATIC_CONDITIONS;
  }

  public static fromStaticElementName(name: StaticElementName) {
    const options = STATIC_CONDITIONS[name];

    if (!options) {
      throw new Error(`Unsupported static element "${name}"`);
    }

    return new ConditionOptions(options);
  }

  public static empty() {
    return new ConditionOptions([]);
  }

  public isEmpty() {
    return this.length === 0;
  }

  public findByLabel(label: string | undefined) {
    return label === undefined ? undefined : this.find((f) => f.label === label);
  }

  public first(): ConditionItem {
    const [first] = this;

    if (!first) {
      throw new Error("A condition list is never empty");
    }

    return first;
  }
}
