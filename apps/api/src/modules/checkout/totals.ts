import { addMoney, type CurrencyCode, type Money, multiplyMoney } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { eq } from "drizzle-orm";
import { getProductVariantsByIds, type ProductVariantRow, toMoney } from "../catalog/index.ts";
import {
  type CheckoutLineRow,
  CheckoutNotFoundError,
  getCheckoutLines,
  getCheckoutShippingMethod,
} from "./checkouts.ts";

// Saleor's checkout calculations (ARCHITECTURE.md §5.2): always computed from the current variant
// prices, never stored. Tax is zero, but the API still returns Saleor's TaxedMoney with
// `net = gross`, so the shape won't change when taxes arrive.

export type TaxedMoney = {
  currency: CurrencyCode;
  net: Money;
  gross: Money;
  tax: Money;
};

export type CheckoutTotalsLine = {
  line: CheckoutLineRow;
  unitPrice: Money;
  totalPrice: Money;
};

export type CheckoutTotals = {
  lines: CheckoutTotalsLine[];
  subtotal: TaxedMoney;
  shipping: TaxedMoney;
  total: TaxedMoney;
};

/** The same amount before and after tax, with a zero tax (ARCHITECTURE.md §5.2). */
export function taxedMoney(money: Money): TaxedMoney {
  return {
    currency: money.currency,
    net: money,
    gross: money,
    tax: toMoney(0, money.currency),
  };
}

/**
 * Live totals for a checkout: each line at the variant's current price, plus the chosen shipping
 * method's current price (zero without one, or when it was switched off). An empty checkout is
 * zero in its own currency.
 */
export async function calculateCheckoutTotals(
  db: Executor,
  checkoutId: string,
): Promise<CheckoutTotals> {
  const [checkout] = await db
    .select()
    .from(schema.checkout)
    .where(eq(schema.checkout.id, checkoutId));
  if (!checkout) throw new CheckoutNotFoundError([checkoutId]);

  const lines = await getCheckoutLines(db, checkoutId);
  const variants = await getProductVariantsByIds(
    db,
    lines.map((line) => line.variantId),
  );
  const byId = new Map<string, ProductVariantRow>(variants.map((variant) => [variant.id, variant]));

  let subtotal = toMoney(0, checkout.currency);
  const pricedLines = lines.map((line) => {
    const variant = byId.get(line.variantId);
    // The foreign key cascades, so a line's variant always exists.
    if (!variant) throw new Error(`checkout line ${line.id} has no variant`);
    const unitPrice = toMoney(variant.priceAmount, variant.currency);
    const totalPrice = multiplyMoney(unitPrice, line.quantity);
    subtotal = addMoney(subtotal, totalPrice);
    return { line, unitPrice, totalPrice };
  });

  const method = await getCheckoutShippingMethod(db, checkout);
  const shipping = method
    ? toMoney(method.priceAmount, method.currency)
    : toMoney(0, checkout.currency);

  return {
    lines: pricedLines,
    subtotal: taxedMoney(subtotal),
    shipping: taxedMoney(shipping),
    total: taxedMoney(addMoney(subtotal, shipping)),
  };
}
