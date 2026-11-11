import { type CurrencyCode, parseDecimal } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { asc, eq, sql } from "drizzle-orm";

// Shipping methods as a flat list (PLAN M5 decision 1, ARCHITECTURE §3 "Checkout"): Saleor's
// shippingPriceCreate/Update/Delete without zones, channel listings, postal-code or weight rules.
// The price is stored on the row in the shop currency, as a variant's.

export type ShippingMethodRow = typeof schema.shippingMethod.$inferSelect;

export type ShippingErrorCode = "INVALID" | "REQUIRED";

export type ShippingError = { field: string | null; code: ShippingErrorCode; message: string };

export type ShippingMethodResult =
  | { ok: true; shippingMethod: ShippingMethodRow }
  | { ok: false; errors: ShippingError[] };

export type ShippingMethodInput = {
  name?: string | null;
  /** A decimal amount in the shop currency, as the API's Decimal scalar delivers it. */
  price?: string | null;
  isActive?: boolean | null;
};

/** The shop's single currency (ADR-0005, ADR-0013), as catalog's SHOP_CURRENCY. */
const SHOP_CURRENCY: CurrencyCode = "MNT";

const MESSAGES = {
  required: "This field is required.",
  negativePrice: "Shipping can't have negative price.",
  invalidPrice: "Enter a valid price.",
  tooManyDecimals: "Value cannot have more decimal places than the currency allows.",
};

/** A shipping method id that matches no row; the GraphQL layer maps it to Saleor's node error. */
export class ShippingMethodNotFoundError extends Error {
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`Shipping method not found: ${ids.join(", ")}`);
    this.name = "ShippingMethodNotFoundError";
    this.ids = ids;
  }
}

function cleanName(name: string, errors: ShippingError[]): string {
  const value = name.trim();
  if (value === "") errors.push({ field: "name", code: "REQUIRED", message: MESSAGES.required });
  return value;
}

function cleanPrice(price: string, errors: ShippingError[]): number {
  try {
    const { amountMinor } = parseDecimal(price, SHOP_CURRENCY);
    if (amountMinor < 0) {
      errors.push({ field: "price", code: "INVALID", message: MESSAGES.negativePrice });
    }
    return amountMinor;
  } catch (error) {
    errors.push({
      field: "price",
      code: "INVALID",
      message: error instanceof RangeError ? MESSAGES.tooManyDecimals : MESSAGES.invalidPrice,
    });
    return 0;
  }
}

/** Every shipping method, by name then id (staff list). */
export async function listShippingMethods(db: Executor): Promise<ShippingMethodRow[]> {
  return db
    .select()
    .from(schema.shippingMethod)
    .orderBy(asc(schema.shippingMethod.name), asc(schema.shippingMethod.id));
}

/** The methods a checkout may choose: the active ones, cheapest first (then name, id). */
export async function listActiveShippingMethods(db: Executor): Promise<ShippingMethodRow[]> {
  return db
    .select()
    .from(schema.shippingMethod)
    .where(eq(schema.shippingMethod.isActive, true))
    .orderBy(
      asc(schema.shippingMethod.priceAmount),
      asc(schema.shippingMethod.name),
      asc(schema.shippingMethod.id),
    );
}

export async function getShippingMethod(
  db: Executor,
  id: string,
): Promise<ShippingMethodRow | null> {
  const [row] = await db
    .select()
    .from(schema.shippingMethod)
    .where(eq(schema.shippingMethod.id, id));
  return row ?? null;
}

export async function createShippingMethod(
  db: Executor,
  input: ShippingMethodInput,
): Promise<ShippingMethodResult> {
  const errors: ShippingError[] = [];
  const name = cleanName(input.name ?? "", errors);
  let priceAmount = 0;
  if (input.price === undefined || input.price === null) {
    errors.push({ field: "price", code: "REQUIRED", message: MESSAGES.required });
  } else {
    priceAmount = cleanPrice(input.price, errors);
  }
  if (errors.length > 0) return { ok: false, errors };

  const [shippingMethod] = await db
    .insert(schema.shippingMethod)
    .values({
      name,
      priceAmount,
      currency: SHOP_CURRENCY,
      ...(input.isActive === undefined || input.isActive === null
        ? {}
        : { isActive: input.isActive }),
    })
    .returning();
  if (!shippingMethod) throw new Error("shipping method insert returned no row");
  return { ok: true, shippingMethod };
}

/** Only the given fields change; `null` for name or price is "unchanged", as Saleor's input. */
export async function updateShippingMethod(
  db: Executor,
  id: string,
  input: ShippingMethodInput,
): Promise<ShippingMethodResult> {
  const errors: ShippingError[] = [];
  const values: Partial<typeof schema.shippingMethod.$inferInsert> = {};
  if (input.name !== undefined && input.name !== null) values.name = cleanName(input.name, errors);
  if (input.price !== undefined && input.price !== null) {
    values.priceAmount = cleanPrice(input.price, errors);
  }
  if (input.isActive !== undefined && input.isActive !== null) values.isActive = input.isActive;
  if (errors.length > 0) return { ok: false, errors };

  const [shippingMethod] = await db
    .update(schema.shippingMethod)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(schema.shippingMethod.id, id))
    .returning();
  if (!shippingMethod) throw new ShippingMethodNotFoundError([id]);
  return { ok: true, shippingMethod };
}

/** Deletes a method; checkouts that chose it are left without one (FK `ON DELETE SET NULL`). */
export async function deleteShippingMethod(db: Executor, id: string): Promise<ShippingMethodRow> {
  const [shippingMethod] = await db
    .delete(schema.shippingMethod)
    .where(eq(schema.shippingMethod.id, id))
    .returning();
  if (!shippingMethod) throw new ShippingMethodNotFoundError([id]);
  return shippingMethod;
}

/** The demo methods `pnpm cli seed-shipping` creates; names are unique among the seeded rows. */
export const DEMO_SHIPPING_METHODS = [
  { name: "Standard", price: "5000" },
  { name: "Express", price: "15000" },
] as const;

/** Creates the demo methods that don't exist yet (by name); safe to run again. */
export async function seedDemoShippingMethods(
  db: Executor,
): Promise<{ created: number; skipped: number }> {
  const existing = new Set((await listShippingMethods(db)).map((method) => method.name));
  let created = 0;
  for (const method of DEMO_SHIPPING_METHODS) {
    if (existing.has(method.name)) continue;
    const result = await createShippingMethod(db, method);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    created += 1;
  }
  return { created, skipped: DEMO_SHIPPING_METHODS.length - created };
}
