import { type Db, schema } from "@commerce/db";
import { eq } from "drizzle-orm";

/**
 * Marks a checkout completed by pointing it at a minimal order, for tests that only need the
 * read-only state (the `completed_order_id` foreign key needs a real order row since M5.4).
 */
export async function markCheckoutCompleted(db: Db, checkoutId: string): Promise<void> {
  const address = { firstName: "A", lastName: "B", streetAddress1: "C", city: "D", country: "MN" };
  const [order] = await db
    .insert(schema.order)
    .values({
      status: "UNFULFILLED",
      userEmail: "buyer@example.com",
      billingAddress: address,
      shippingAddress: address,
      shippingMethodName: "Standard",
      shippingPriceAmount: 0,
      subtotalAmount: 0,
      totalAmount: 0,
      currency: "MNT",
    })
    .returning();
  if (!order) throw new Error("no order");
  await db
    .update(schema.checkout)
    .set({ completedOrderId: order.id })
    .where(eq(schema.checkout.id, checkoutId));
}
