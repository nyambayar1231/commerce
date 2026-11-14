import type { CurrencyCode } from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  getProduct,
  getProductVariantsByIds,
  isProductPublished,
  type ProductRow,
  type ProductVariantRow,
} from "../catalog/index.ts";
import { availableQuantity, getStocksByVariantIds, type StockRow } from "../inventory/index.ts";
import { type AddressInput, type AddressType, cleanAddress } from "./addresses.ts";
import { getShippingMethod } from "./shippingMethods.ts";

// Checkout reads and writes (ARCHITECTURE.md §3 "Checkout", §5.2–5.3): Saleor's checkout
// mutations translated to our single-channel, single-currency model. A checkout stores no
// prices; totals are computed by totals.ts. Stock is checked advisorily here and authoritatively
// at completion (M5.4).

export type CheckoutRow = typeof schema.checkout.$inferSelect;
export type CheckoutLineRow = typeof schema.checkoutLine.$inferSelect;

// Saleor's CheckoutErrorCode values these functions can return. The GraphQL layer adds nothing.
export type CheckoutErrorCode =
  | "BILLING_ADDRESS_NOT_SET"
  | "CHECKOUT_NOT_FULLY_PAID"
  | "DELIVERY_METHOD_NOT_APPLICABLE"
  | "EMAIL_NOT_SET"
  | "INSUFFICIENT_STOCK"
  | "INVALID"
  | "INVALID_SHIPPING_METHOD"
  | "NO_LINES"
  | "NOT_FOUND"
  | "PRODUCT_NOT_PUBLISHED"
  | "QUANTITY_GREATER_THAN_LIMIT"
  | "REQUIRED"
  | "SHIPPING_ADDRESS_NOT_SET"
  | "SHIPPING_METHOD_NOT_SET"
  | "ZERO_QUANTITY";

export type CheckoutError = {
  field: string | null;
  code: CheckoutErrorCode;
  message: string;
  variants: string[] | null;
  lines: string[] | null;
  /** Set on address errors: which of the checkout's addresses the field belongs to. */
  addressType?: AddressType | null;
};

export type CheckoutResult =
  | { ok: true; checkout: CheckoutRow }
  | { ok: false; errors: CheckoutError[] };

export type CheckoutLineInput = { variantId: string; quantity: number };
export type CheckoutLineQuantityInput = { lineId: string; quantity: number };

/** Saleor's `site.limitQuantityPerCheckout` default; one line can't exceed it (ARCHITECTURE §5.3). */
export const MAX_CHECKOUT_LINE_QUANTITY = 50;

// The shop has one currency (ADR-0005, ADR-0013). Catalog keeps its own constant for the variants
// it writes; a checkout created without lines has no variant to read the currency from.
const SHOP_CURRENCY: CurrencyCode = "MNT";

const MESSAGES = {
  blank: "This field cannot be blank.",
  invalidEmail: "Enter a valid email address.",
  completed: "The checkout is already completed.",
  zeroQuantity: "The quantity should be higher than zero.",
  zeroQuantityUpdate: "The quantity should be higher or equal zero.",
  notPublished: "Cannot add lines for unpublished variants.",
  quantityLimit: (limit: number, label: string) =>
    `Cannot add more than ${limit} times this item: ${label}.`,
  insufficientStock: (label: string, available: number) =>
    `Could not add items ${label}. Only ${available} remaining in stock.`,
  currencyMismatch: "All checkout lines must use the same currency.",
  deliveryMethodNotApplicable: "This shipping method is not applicable.",
} as const;

/** A checkout id that matches no row; the GraphQL layer maps it to Saleor's node error. */
export class CheckoutNotFoundError extends Error {
  readonly ids: string[];

  constructor(ids: string[]) {
    super(`Checkout not found: ${ids.join(", ")}`);
    this.name = "CheckoutNotFoundError";
    this.ids = ids;
  }
}

/**
 * Saleor's PermissionDenied for checkout ownership (checkoutCustomerAttach/Detach). The GraphQL
 * layer turns it into a top-level error; `permissions` names what would have allowed it.
 */
export class CheckoutPermissionError extends Error {
  readonly permissions: readonly string[];

  constructor(message: string, permissions: readonly string[] = []) {
    super(message);
    this.name = "CheckoutPermissionError";
    this.permissions = permissions;
  }
}

function checkoutError(
  field: string | null,
  code: CheckoutErrorCode,
  message: string,
  extra: { variants?: string[]; lines?: string[] } = {},
): CheckoutError {
  return { field, code, message, variants: extra.variants ?? null, lines: extra.lines ?? null };
}

function notFoundError(field: string, ids: string[]): CheckoutError {
  const lines = field === "lineId" || field === "linesIds";
  return checkoutError(field, "NOT_FOUND", `Couldn't resolve to a node: ${ids.join(", ")}.`, {
    ...(lines ? { lines: ids } : { variants: ids }),
  });
}

/** Saleor's `add_variants_to_checkout`: duplicated input lines for one variant are summed. */
function mergeLineInputs(lines: readonly CheckoutLineInput[]): CheckoutLineInput[] {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...quantities].map(([variantId, quantity]) => ({ variantId, quantity }));
}

function cleanEmail(email: string): { value: string; errors: CheckoutError[] } {
  const value = email.trim();
  if (value === "") {
    return { value, errors: [checkoutError("email", "REQUIRED", MESSAGES.blank)] };
  }
  // A simple local@domain.tld check; Saleor's full Django validator is out of scope.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { value, errors: [checkoutError("email", "INVALID", MESSAGES.invalidEmail)] };
  }
  return { value, errors: [] };
}

function completedError(checkout: CheckoutRow): CheckoutError | null {
  if (checkout.completedOrderId === null) return null;
  return checkoutError("id", "INVALID", MESSAGES.completed);
}

/** A checkout that must exist, locked for the rest of the transaction. */
export async function lockCheckout(db: Executor, id: string): Promise<CheckoutRow> {
  const [checkout] = await db
    .select()
    .from(schema.checkout)
    .where(eq(schema.checkout.id, id))
    .for("update");
  if (!checkout) throw new CheckoutNotFoundError([id]);
  return checkout;
}

async function bumpCheckout(db: Executor, id: string): Promise<void> {
  await db.update(schema.checkout).set({ updatedAt: sql`now()` }).where(eq(schema.checkout.id, id));
}

async function loadVariants(
  db: Executor,
  ids: readonly string[],
): Promise<Map<string, ProductVariantRow>> {
  const rows = await getProductVariantsByIds(db, [...new Set(ids)]);
  return new Map(rows.map((row) => [row.id, row]));
}

/** The products of the given variants, one read per distinct product. */
async function loadProducts(
  db: Executor,
  variants: Iterable<ProductVariantRow>,
): Promise<Map<string, ProductRow>> {
  const ids = [...new Set([...variants].map((variant) => variant.productId))];
  const rows = await Promise.all(ids.map((id) => getProduct(db, { id })));
  return new Map(rows.filter((row): row is ProductRow => row !== null).map((row) => [row.id, row]));
}

/** Catalog's anonymous visibility rule (catalog's isProductPublished). */
export const isPublished = isProductPublished;

/** Saleor's `available_quantity_for_stock`, for the variants that track inventory. */
async function loadAvailableQuantities(
  db: Executor,
  variants: Iterable<ProductVariantRow>,
): Promise<Map<string, number>> {
  const tracked = [...variants].filter((variant) => variant.trackInventory);
  const stocks = await getStocksByVariantIds(
    db,
    tracked.map((variant) => variant.id),
  );
  const byVariant = new Map<string, StockRow[]>();
  for (const stock of stocks) {
    const rows = byVariant.get(stock.variantId);
    if (rows) rows.push(stock);
    else byVariant.set(stock.variantId, [stock]);
  }
  return new Map(
    tracked.map((variant) => [variant.id, availableQuantity(byVariant.get(variant.id) ?? [])]),
  );
}

/** Saleor's `<sku or name>` in the out-of-stock message. */
const variantLabel = (variant: ProductVariantRow): string =>
  variant.sku === null || variant.sku === "" ? variant.name : variant.sku;

type RequestedQuantities = Map<string, number>;

type Validation = {
  errors: CheckoutError[];
  variants: Map<string, ProductVariantRow>;
};

/**
 * Saleor's `check_lines_quantity` plus the publication check: the resulting quantity of a line
 * (`existing + requested`) must be in stock, at most MAX_CHECKOUT_LINE_QUANTITY, and its product
 * published. `replace` makes the requested quantity the resulting one (checkoutLinesUpdate).
 */
async function validateLines(
  db: Executor,
  lines: readonly CheckoutLineInput[],
  existing: RequestedQuantities,
  replace: boolean,
): Promise<Validation> {
  const errors: CheckoutError[] = [];
  const zeroMessage = replace ? MESSAGES.zeroQuantityUpdate : MESSAGES.zeroQuantity;

  for (const line of lines) {
    if (replace ? line.quantity < 0 : line.quantity <= 0) {
      errors.push(
        checkoutError("quantity", "ZERO_QUANTITY", zeroMessage, { variants: [line.variantId] }),
      );
    }
  }

  const variants = await loadVariants(
    db,
    lines.map((line) => line.variantId),
  );
  const missing = lines.filter((line) => !variants.has(line.variantId));
  if (missing.length > 0) {
    errors.push(
      notFoundError(
        "variantId",
        missing.map((line) => line.variantId),
      ),
    );
  }

  const checkable = lines.filter((line) => variants.has(line.variantId) && line.quantity > 0);
  const products = await loadProducts(db, variants.values());

  const unpublished = checkable.filter((line) => {
    const variant = variants.get(line.variantId);
    const product = variant ? products.get(variant.productId) : undefined;
    return product === undefined || !isPublished(product);
  });
  if (unpublished.length > 0) {
    errors.push(
      checkoutError("lines", "PRODUCT_NOT_PUBLISHED", MESSAGES.notPublished, {
        variants: unpublished.map((line) => line.variantId),
      }),
    );
  }

  const resulting = checkable.map((line) => ({
    line,
    quantity: replace ? line.quantity : (existing.get(line.variantId) ?? 0) + line.quantity,
  }));

  const overLimit = resulting.filter(({ quantity }) => quantity > MAX_CHECKOUT_LINE_QUANTITY);
  for (const { line } of overLimit) {
    const variant = variants.get(line.variantId);
    if (!variant) continue;
    errors.push(
      checkoutError(
        "quantity",
        "QUANTITY_GREATER_THAN_LIMIT",
        MESSAGES.quantityLimit(MAX_CHECKOUT_LINE_QUANTITY, variantLabel(variant)),
        { variants: [variant.id] },
      ),
    );
  }

  // Saleor's _check_quantity_limits raises before the stock check, so a line over the limit gets
  // only the limit error.
  const overLimitIds = new Set(overLimit.map(({ line }) => line.variantId));
  const available = await loadAvailableQuantities(db, variants.values());
  for (const { line, quantity } of resulting) {
    const variant = variants.get(line.variantId);
    if (!variant?.trackInventory || overLimitIds.has(variant.id)) continue;
    const inStock = available.get(variant.id) ?? 0;
    if (quantity > inStock) {
      errors.push(
        checkoutError(
          "quantity",
          "INSUFFICIENT_STOCK",
          MESSAGES.insufficientStock(variantLabel(variant), inStock),
          { variants: [variant.id] },
        ),
      );
    }
  }

  return { errors, variants };
}

/** Every line of a checkout, in creation order (`created_at`, then `id` so it is total). */
export async function getCheckoutLines(
  db: Executor,
  checkoutId: string,
): Promise<CheckoutLineRow[]> {
  return db
    .select()
    .from(schema.checkoutLine)
    .where(eq(schema.checkoutLine.checkoutId, checkoutId))
    .orderBy(asc(schema.checkoutLine.createdAt), asc(schema.checkoutLine.id));
}

const existingQuantities = (lines: readonly CheckoutLineRow[]): Map<string, number> =>
  new Map(lines.map((line) => [line.variantId, line.quantity]));

function currencyError(
  variants: Map<string, ProductVariantRow>,
  lines: readonly CheckoutLineInput[],
  currency: string,
): CheckoutError | null {
  for (const line of lines) {
    if (variants.get(line.variantId)?.currency !== currency) {
      return checkoutError("currency", "INVALID", MESSAGES.currencyMismatch);
    }
  }
  return null;
}

export async function createCheckout(
  db: Executor,
  input: {
    email?: string | null;
    lines: readonly CheckoutLineInput[];
    /** The logged-in user creating it (Saleor: any authenticated user owns the new checkout). */
    user?: { id: string; email: string } | null;
  },
): Promise<CheckoutResult> {
  const lines = mergeLineInputs(input.lines);

  return db.transaction(async (tx) => {
    const errors: CheckoutError[] = [];
    // Saleor: the given email, or the logged-in user's.
    let email: string | null = input.user?.email ?? null;
    if (input.email !== undefined && input.email !== null) {
      const cleaned = cleanEmail(input.email);
      errors.push(...cleaned.errors);
      email = cleaned.value;
    }

    const validation = await validateLines(tx, lines, new Map(), false);
    errors.push(...validation.errors);

    const firstVariant = lines[0] ? validation.variants.get(lines[0].variantId) : undefined;
    const currency = firstVariant?.currency ?? SHOP_CURRENCY;
    if (validation.errors.length === 0) {
      const mismatch = currencyError(validation.variants, lines, currency);
      if (mismatch) errors.push(mismatch);
    }
    if (errors.length > 0) return { ok: false, errors };

    const [checkout] = await tx
      .insert(schema.checkout)
      .values({ email, currency, userId: input.user?.id ?? null })
      .returning();
    if (!checkout) throw new Error("checkout insert returned no row");

    if (lines.length > 0) {
      await tx.insert(schema.checkoutLine).values(
        lines.map((line) => ({
          checkoutId: checkout.id,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      );
    }
    return { ok: true, checkout };
  });
}

export async function addCheckoutLines(
  db: Executor,
  checkoutId: string,
  lines: readonly CheckoutLineInput[],
): Promise<CheckoutResult> {
  const grouped = mergeLineInputs(lines);

  return db.transaction(async (tx) => {
    const checkout = await lockCheckout(tx, checkoutId);
    const completed = completedError(checkout);
    if (completed) return { ok: false, errors: [completed] };

    const existingRows = await getCheckoutLines(tx, checkoutId);
    const validation = await validateLines(tx, grouped, existingQuantities(existingRows), false);
    const errors = [...validation.errors];
    if (errors.length === 0) {
      const mismatch = currencyError(validation.variants, grouped, checkout.currency);
      if (mismatch) errors.push(mismatch);
    }
    if (errors.length > 0) return { ok: false, errors };

    const byVariant = new Map(existingRows.map((line) => [line.variantId, line]));
    for (const line of grouped) {
      const existing = byVariant.get(line.variantId);
      if (existing) {
        await tx
          .update(schema.checkoutLine)
          .set({ quantity: existing.quantity + line.quantity })
          .where(eq(schema.checkoutLine.id, existing.id));
      } else {
        await tx.insert(schema.checkoutLine).values({
          checkoutId,
          variantId: line.variantId,
          quantity: line.quantity,
        });
      }
    }
    await bumpCheckout(tx, checkoutId);

    const updated = await getCheckout(tx, checkoutId);
    if (!updated) throw new CheckoutNotFoundError([checkoutId]);
    return { ok: true, checkout: updated };
  });
}

export async function updateCheckoutLines(
  db: Executor,
  checkoutId: string,
  lines: readonly CheckoutLineQuantityInput[],
): Promise<CheckoutResult> {
  // Saleor's group_lines_input_data_on_update: later entries for a line win.
  const quantities = new Map(lines.map((line) => [line.lineId, line.quantity]));

  return db.transaction(async (tx) => {
    const checkout = await lockCheckout(tx, checkoutId);
    const completed = completedError(checkout);
    if (completed) return { ok: false, errors: [completed] };

    const existingRows = await getCheckoutLines(tx, checkoutId);
    const byId = new Map(existingRows.map((line) => [line.id, line]));
    const unknown = [...quantities.keys()].filter((lineId) => !byId.has(lineId));
    if (unknown.length > 0) {
      return { ok: false, errors: [notFoundError("lineId", unknown)] };
    }

    const requested: CheckoutLineInput[] = [...quantities].map(([lineId, quantity]) => ({
      variantId: byId.get(lineId)?.variantId ?? "",
      quantity,
    }));

    // Zero means "remove the line", so validateLines skips it; a negative quantity is Saleor's
    // ZERO_QUANTITY error ("higher or equal zero").
    const validation = await validateLines(tx, requested, new Map(), true);
    if (validation.errors.length > 0) return { ok: false, errors: validation.errors };

    for (const [lineId, quantity] of quantities) {
      if (quantity === 0) {
        await tx.delete(schema.checkoutLine).where(eq(schema.checkoutLine.id, lineId));
      } else {
        await tx
          .update(schema.checkoutLine)
          .set({ quantity })
          .where(eq(schema.checkoutLine.id, lineId));
      }
    }
    await bumpCheckout(tx, checkoutId);

    const updated = await getCheckout(tx, checkoutId);
    if (!updated) throw new CheckoutNotFoundError([checkoutId]);
    return { ok: true, checkout: updated };
  });
}

export async function deleteCheckoutLines(
  db: Executor,
  checkoutId: string,
  lineIds: readonly string[],
): Promise<CheckoutResult> {
  const ids = [...new Set(lineIds)];

  return db.transaction(async (tx) => {
    const checkout = await lockCheckout(tx, checkoutId);
    const completed = completedError(checkout);
    if (completed) return { ok: false, errors: [completed] };

    const existing = await getCheckoutLines(tx, checkoutId);
    const known = new Set(existing.map((line) => line.id));
    const unknown = ids.filter((lineId) => !known.has(lineId));
    if (unknown.length > 0) {
      return { ok: false, errors: [notFoundError("linesIds", unknown)] };
    }

    if (ids.length > 0) {
      await tx
        .delete(schema.checkoutLine)
        .where(
          and(eq(schema.checkoutLine.checkoutId, checkoutId), inArray(schema.checkoutLine.id, ids)),
        );
    }
    await bumpCheckout(tx, checkoutId);

    const updated = await getCheckout(tx, checkoutId);
    if (!updated) throw new CheckoutNotFoundError([checkoutId]);
    return { ok: true, checkout: updated };
  });
}

export async function updateCheckoutEmail(
  db: Executor,
  checkoutId: string,
  email: string,
): Promise<CheckoutResult> {
  const cleaned = cleanEmail(email);

  return db.transaction(async (tx) => {
    const checkout = await lockCheckout(tx, checkoutId);
    const completed = completedError(checkout);
    if (completed) return { ok: false, errors: [completed] };
    if (cleaned.errors.length > 0) return { ok: false, errors: cleaned.errors };

    await tx
      .update(schema.checkout)
      .set({ email: cleaned.value, updatedAt: sql`now()` })
      .where(eq(schema.checkout.id, checkoutId));

    const updated = await getCheckout(tx, checkoutId);
    if (!updated) throw new CheckoutNotFoundError([checkoutId]);
    return { ok: true, checkout: updated };
  });
}

/** A checkout by id, or null when it doesn't exist (`Query.checkout`). */
export async function getCheckout(db: Executor, id: string): Promise<CheckoutRow | null> {
  const [checkout] = await db.select().from(schema.checkout).where(eq(schema.checkout.id, id));
  return checkout ?? null;
}

/** Locks the checkout, rejects a completed one, runs `write` and returns the fresh row. */
async function writeCheckout(
  db: Executor,
  checkoutId: string,
  write: (tx: Executor, checkout: CheckoutRow) => Promise<CheckoutError[]>,
): Promise<CheckoutResult> {
  return db.transaction(async (tx) => {
    const checkout = await lockCheckout(tx, checkoutId);
    const completed = completedError(checkout);
    if (completed) return { ok: false, errors: [completed] };

    const errors = await write(tx, checkout);
    if (errors.length > 0) return { ok: false, errors };

    const updated = await getCheckout(tx, checkoutId);
    if (!updated) throw new CheckoutNotFoundError([checkoutId]);
    return { ok: true, checkout: updated };
  });
}

/**
 * Saleor's checkoutCustomerAttach for the logged-in user: they become the checkout's owner and its
 * email becomes theirs. A checkout that already has an owner (even this user) is refused, as in
 * Saleor ("You cannot reassign…").
 */
export async function attachCheckoutCustomer(
  db: Executor,
  checkoutId: string,
  user: { id: string; email: string },
): Promise<CheckoutResult> {
  return writeCheckout(db, checkoutId, async (tx, checkout) => {
    if (checkout.userId !== null) {
      throw new CheckoutPermissionError(
        "You cannot reassign a checkout that is already attached to a user.",
      );
    }
    await tx
      .update(schema.checkout)
      .set({ userId: user.id, email: user.email, updatedAt: sql`now()` })
      .where(eq(schema.checkout.id, checkoutId));
    return [];
  });
}

/**
 * Saleor's checkoutCustomerDetach: removes the owner. Only the owner may do it (Saleor also lets
 * IMPERSONATE_USER staff, a permission we don't have); an unowned checkout stays as it is.
 */
export async function detachCheckoutCustomer(
  db: Executor,
  checkoutId: string,
  requesterId: string,
): Promise<CheckoutResult> {
  return writeCheckout(db, checkoutId, async (tx, checkout) => {
    if (checkout.userId !== null && checkout.userId !== requesterId) {
      throw new CheckoutPermissionError("You can't detach another user's checkout.", ["OWNER"]);
    }
    await tx
      .update(schema.checkout)
      .set({ userId: null, updatedAt: sql`now()` })
      .where(eq(schema.checkout.id, checkoutId));
    return [];
  });
}

/** The checkouts a user owns that are not completed yet, newest first (`User.checkouts`). */
export async function getOpenCheckoutsByUserId(
  db: Executor,
  userId: string,
): Promise<CheckoutRow[]> {
  return db
    .select()
    .from(schema.checkout)
    .where(and(eq(schema.checkout.userId, userId), isNull(schema.checkout.completedOrderId)))
    .orderBy(desc(schema.checkout.createdAt), desc(schema.checkout.id));
}

/**
 * Saleor's checkoutShippingAddressUpdate / checkoutBillingAddressUpdate: the cleaned address
 * replaces the stored snapshot. Errors carry Saleor's `addressType`.
 */
export async function updateCheckoutAddress(
  db: Executor,
  checkoutId: string,
  addressType: AddressType,
  input: AddressInput,
): Promise<CheckoutResult> {
  const cleaned = cleanAddress(input);
  const column = addressType === "SHIPPING" ? "shippingAddress" : "billingAddress";

  return writeCheckout(db, checkoutId, async (tx) => {
    if (!cleaned.ok) {
      return cleaned.errors.map((error) => ({
        ...checkoutError(error.field, error.code, error.message),
        addressType,
      }));
    }
    await tx
      .update(schema.checkout)
      .set({ [column]: cleaned.address, updatedAt: sql`now()` })
      .where(eq(schema.checkout.id, checkoutId));
    return [];
  });
}

/**
 * Saleor's checkoutDeliveryMethodUpdate for shipping methods: `null` clears the choice; an unknown
 * or inactive method is DELIVERY_METHOD_NOT_APPLICABLE. With a flat list (PLAN M5 decision 1)
 * every active method applies, whatever the address.
 */
export async function updateCheckoutDeliveryMethod(
  db: Executor,
  checkoutId: string,
  shippingMethodId: string | null,
): Promise<CheckoutResult> {
  return writeCheckout(db, checkoutId, async (tx, checkout) => {
    if (shippingMethodId !== null) {
      // A concurrent deactivation can still win the race; completion re-checks the method (§5.4).
      const method = await getShippingMethod(tx, shippingMethodId);
      if (!method?.isActive || method.currency !== checkout.currency) {
        return [
          checkoutError(
            "deliveryMethodId",
            "DELIVERY_METHOD_NOT_APPLICABLE",
            MESSAGES.deliveryMethodNotApplicable,
          ),
        ];
      }
    }
    await tx
      .update(schema.checkout)
      .set({ shippingMethodId, updatedAt: sql`now()` })
      .where(eq(schema.checkout.id, checkoutId));
    return [];
  });
}

/** The checkout's chosen method while it is still active; an inactive one no longer applies. */
export async function getCheckoutShippingMethod(db: Executor, checkout: CheckoutRow) {
  if (checkout.shippingMethodId === null) return null;
  const method = await getShippingMethod(db, checkout.shippingMethodId);
  return method?.isActive ? method : null;
}
