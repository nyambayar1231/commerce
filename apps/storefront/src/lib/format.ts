import { CURRENCIES, type Money } from "@commerce/contracts";
import { TIME_ZONE } from "@/i18n/config";

const LOCALE_TAG = "mn-MN";

// Server-side only (ARCHITECTURE §10.11): client components get strings, so a browser's ICU data
// can't cause a hydration mismatch. Nowhere else formats money or dates.

export function formatMoney(money: Money): string {
  const { exponent } = CURRENCIES[money.currency];
  return new Intl.NumberFormat(LOCALE_TAG, {
    style: "currency",
    currency: money.currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(money.amountMinor / 10 ** exponent);
}

export function formatDate(iso: string, style: "short" | "long"): string {
  return new Intl.DateTimeFormat(LOCALE_TAG, {
    dateStyle: style,
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}
