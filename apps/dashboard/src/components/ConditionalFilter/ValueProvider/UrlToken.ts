// Adapted from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/UrlToken.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's URL token: `s<condition>.<field>`, e.g. `s2.category` ("in", category), with the
// value(s) as the query value. Only static product fields are kept; the attribute token types
// (o/m/n/t/d/b/r) are dropped, so an attribute entry is not a static token and is ignored.
import type { ConditionSelected } from "../FilterElement/ConditionSelected";
import { slugFromConditionValue } from "../FilterElement/ConditionValue";

/** Saleor's condition order. The index in this list is the number in `s<index>.<field>`. */
const CONDITIONS = ["is", "equals", "in", "between", "lower", "greater"];

export const TokenType = {
  STATIC: "s",
} as const;

export class UrlEntry {
  constructor(key: string, value: string | string[]) {
    (this as unknown as Record<string, string | string[]>)[key] = value;
  }

  public static forStatic(condition: ConditionSelected, paramName: string) {
    const { conditionValue } = condition;
    const slug = slugFromConditionValue(condition.value);

    if (!conditionValue) {
      return new UrlEntry(TokenType.STATIC, slug);
    }

    const conditionIndex = CONDITIONS.indexOf(conditionValue.label);

    return new UrlEntry(`${TokenType.STATIC}${conditionIndex}.${paramName}`, slug);
  }

  public getInfo() {
    const [key, value] = Object.entries(this)[0] as [string, string | string[]];
    const [identifier, entryName] = key.split(".");
    const type = identifier?.charAt(0) ?? "";
    const control = Number.parseInt(identifier?.slice(1) ?? "", 10);
    const conditionKind = Number.isNaN(control) ? undefined : CONDITIONS[control];

    return { key, value, entryName, type, conditionKind };
  }
}

export class UrlToken {
  constructor(
    public name: string,
    public value: string | string[],
    public type: string,
    public conditionKind: string,
  ) {}

  /** null for a key that is not `<type><condition>.<field>` with a known condition. */
  public static fromUrlEntry(entry: UrlEntry): UrlToken | null {
    const { entryName, value, type, conditionKind } = entry.getInfo();

    if (!entryName || !conditionKind) {
      return null;
    }

    return new UrlToken(entryName, value, type, conditionKind);
  }

  public isStatic() {
    return this.type === TokenType.STATIC;
  }
}
