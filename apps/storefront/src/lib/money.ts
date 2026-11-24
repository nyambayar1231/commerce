import { CURRENCIES, type CurrencyCode, type Money, parseDecimal } from "@commerce/contracts";

/** The API's `Money { amount, currency }` as a contracts `Money`. Throws on an unknown currency. */
export function toMoney(value: { amount: number; currency: string }): Money {
  if (!Object.hasOwn(CURRENCIES, value.currency)) {
    throw new RangeError(`Unknown currency: ${value.currency}`);
  }
  return parseDecimal(String(value.amount), value.currency as CurrencyCode);
}
