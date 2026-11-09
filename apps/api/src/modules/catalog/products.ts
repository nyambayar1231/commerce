import { CURRENCIES, type CurrencyCode, type Money } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { asc, eq } from "drizzle-orm";

// Product and variant reads (ARCHITECTURE.md §3 "Catalog"). Products are single-channel (ADR-0005):
// publication lives on the product and the price on each variant (ADR-0013).

export type ProductRow = typeof schema.product.$inferSelect;
export type ProductVariantRow = typeof schema.productVariant.$inferSelect;

/**
 * A variant's stored price as Money. The currency is stored per row so multi-currency stays
 * possible later; an unknown code is corrupt data, never silently treated as MNT.
 */
export function toMoney(amountMinor: number, currency: string): Money {
  if (!Object.hasOwn(CURRENCIES, currency)) {
    throw new Error(`Unknown currency in product_variant: ${currency}`);
  }
  return { amountMinor, currency: currency as CurrencyCode };
}

export async function getProduct(
  db: Executor,
  where: { id: string } | { slug: string },
): Promise<ProductRow | null> {
  const condition =
    "id" in where ? eq(schema.product.id, where.id) : eq(schema.product.slug, where.slug);
  const [row] = await db.select().from(schema.product).where(condition);
  return row ?? null;
}

/** A product's variants in display order: `position`, then `id` so the order is total. */
export async function getProductVariants(
  db: Executor,
  productId: string,
): Promise<ProductVariantRow[]> {
  return db
    .select()
    .from(schema.productVariant)
    .where(eq(schema.productVariant.productId, productId))
    .orderBy(asc(schema.productVariant.position), asc(schema.productVariant.id));
}

/** The cheapest variant's price, or null for a product without variants. */
export async function getMinimalVariantPrice(
  db: Executor,
  productId: string,
): Promise<Money | null> {
  const [row] = await db
    .select({
      amountMinor: schema.productVariant.priceAmount,
      currency: schema.productVariant.currency,
    })
    .from(schema.productVariant)
    .where(eq(schema.productVariant.productId, productId))
    .orderBy(asc(schema.productVariant.priceAmount), asc(schema.productVariant.id))
    .limit(1);
  return row ? toMoney(row.amountMinor, row.currency) : null;
}
