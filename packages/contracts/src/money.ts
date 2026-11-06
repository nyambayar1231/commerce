// Money as an integer count of minor units + a currency code (ADR-0013).
// Shared by the API, dashboard and storefront (ADR-0012). Never compute money with fractions.

// Digits after the decimal point per currency. MNT has none: one tögrög is the minor unit.
// Adding a currency later means adding it here; nothing else may assume an exponent.
export const CURRENCIES = {
  MNT: { exponent: 0 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export interface Money {
  readonly amountMinor: number; // integer; for MNT, whole tögrög
  readonly currency: CurrencyCode;
}

// Every Money value passes through here, so an amount is always a safe integer: exact
// arithmetic, and JSON/GraphQL-friendly (unlike bigint).
function checked(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`Money amount must be a safe integer, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

/** Construct MNT. The currency is in the function name, never implicit. */
export function mnt(amountMinor: number): Money {
  return checked(amountMinor, "MNT");
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new TypeError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return checked(a.amountMinor + b.amountMinor, a.currency);
}

/** Line totals: quantity is a count, so it must be a whole number. */
export function multiplyMoney(m: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new TypeError(`Quantity must be an integer, got ${quantity}`);
  }
  return checked(m.amountMinor * quantity, m.currency);
}

/** "15000" → 15000 MNT. Exact: rejects more decimals than the currency has, never rounds. */
export function parseDecimal(value: string, currency: CurrencyCode): Money {
  const { exponent } = CURRENCIES[currency];
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new TypeError(`Invalid decimal amount: "${value}"`);

  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > exponent) {
    throw new RangeError(`${currency} allows at most ${exponent} decimal places: "${value}"`);
  }
  const minor = Number(whole + fraction.padEnd(exponent, "0"));
  return checked(sign === "-" ? -minor : minor, currency);
}

/** 15000 MNT → "15000". The exact inverse of parseDecimal (no symbol, no grouping). */
export function formatDecimal(m: Money): string {
  const { exponent } = CURRENCIES[m.currency];
  if (exponent === 0) return String(m.amountMinor);

  const digits = Math.abs(m.amountMinor)
    .toString()
    .padStart(exponent + 1, "0");
  const sign = m.amountMinor < 0 ? "-" : "";
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}
