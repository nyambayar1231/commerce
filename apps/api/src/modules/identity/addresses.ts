import {
  type Address,
  type AddressError,
  type AddressInput,
  type AddressType,
  type CountryCode,
  cleanAddress,
} from "@commerce/contracts";
import { type Executor, schema } from "@commerce/db";
import { and, asc, count, eq, notInArray, sql } from "drizzle-orm";

// Saleor's customer address book (PLAN M15.2): accountAddressCreate / accountAddressUpdate /
// accountAddressDelete / accountSetDefaultAddress and `User.addresses` (saleor/graphql/account/
// mutations/account/account_address_*.py), plus `store_user_address` at checkout completion
// (../saleor-core/saleor/account/utils.py). Unlike Saleor, one user owns each row (Saleor shares
// through a M2M), so every query filters on `user_id`: another user's address id answers exactly
// like an unknown one (NOT_FOUND), never "permission denied".

export const MAX_USER_ADDRESSES = 100;

export type AddressRow = typeof schema.address.$inferSelect;

/** An address book row as GraphQL shows it, with its owner's default flags. */
export type AddressBookEntry = Address & {
  id: string;
  isDefaultShippingAddress: boolean;
  isDefaultBillingAddress: boolean;
};

export type AddressBookError = {
  field: string;
  message: string;
  code: AddressError["code"] | "NOT_FOUND";
};

export type AddressBookResult =
  | { ok: true; address: AddressBookEntry }
  | { ok: false; errors: AddressBookError[] };

export type AddressBookDefaultResult = { ok: true } | { ok: false; errors: AddressBookError[] };

// The same answer for a malformed id, an unknown one and another user's: a probe learns nothing.
const NOT_FOUND_MESSAGE = "Couldn't resolve to a node.";

export function addressNotFoundError(): AddressBookError {
  return { field: "id", code: "NOT_FOUND", message: NOT_FOUND_MESSAGE };
}

const toErrors = (errors: readonly AddressError[]): AddressBookError[] =>
  errors.map(({ field, code, message }) => ({ field, code, message }));

const textOf = (row: AddressRow): Address => ({
  firstName: row.firstName,
  lastName: row.lastName,
  companyName: row.companyName,
  streetAddress1: row.streetAddress1,
  streetAddress2: row.streetAddress2,
  city: row.city,
  cityArea: row.cityArea,
  postalCode: row.postalCode,
  // cleanAddress validated it before the row was written.
  country: row.country as CountryCode,
  countryArea: row.countryArea,
  phone: row.phone,
});

const toEntry = (
  row: AddressRow,
  defaults: { shipping: string | null; billing: string | null },
): AddressBookEntry => ({
  id: row.id,
  ...textOf(row),
  isDefaultShippingAddress: row.id === defaults.shipping,
  isDefaultBillingAddress: row.id === defaults.billing,
});

/** The user's default address ids; `null` when the user doesn't exist (or has none). */
async function defaultIds(
  db: Executor,
  userId: string,
): Promise<{ shipping: string | null; billing: string | null }> {
  const [row] = await db
    .select({
      shipping: schema.user.defaultShippingAddressId,
      billing: schema.user.defaultBillingAddressId,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId));
  return { shipping: row?.shipping ?? null, billing: row?.billing ?? null };
}

/** One of the user's own addresses, or null. Every lookup carries the user filter. */
async function findOwned(
  db: Executor,
  userId: string,
  addressId: string,
): Promise<AddressRow | null> {
  const [row] = await db
    .select()
    .from(schema.address)
    .where(and(eq(schema.address.id, addressId), eq(schema.address.userId, userId)));
  return row ?? null;
}

async function setDefault(
  db: Executor,
  userId: string,
  addressId: string,
  type: AddressType,
): Promise<void> {
  await db
    .update(schema.user)
    .set({
      ...(type === "SHIPPING"
        ? { defaultShippingAddressId: addressId }
        : { defaultBillingAddressId: addressId }),
      updatedAt: sql`now()`,
    })
    .where(eq(schema.user.id, userId));
}

export async function countUserAddresses(db: Executor, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(schema.address)
    .where(eq(schema.address.userId, userId));
  return row?.count ?? 0;
}

/** Saleor's remove_the_oldest_user_address: drops the oldest row that is not a default. */
async function removeOldestNonDefault(db: Executor, userId: string): Promise<void> {
  const defaults = await defaultIds(db, userId);
  const excluded = [defaults.shipping, defaults.billing].filter((id): id is string => id !== null);
  const [oldest] = await db
    .select({ id: schema.address.id })
    .from(schema.address)
    .where(
      and(
        eq(schema.address.userId, userId),
        excluded.length > 0 ? notInArray(schema.address.id, excluded) : undefined,
      ),
    )
    .orderBy(asc(schema.address.createdAt), asc(schema.address.id))
    .limit(1);
  if (!oldest) return;
  await db
    .delete(schema.address)
    .where(and(eq(schema.address.id, oldest.id), eq(schema.address.userId, userId)));
}

/** The user's address book, oldest first, as `User.addresses` shows it. */
export async function getUserAddresses(db: Executor, userId: string): Promise<AddressBookEntry[]> {
  const defaults = await defaultIds(db, userId);
  const rows = await db
    .select()
    .from(schema.address)
    .where(eq(schema.address.userId, userId))
    .orderBy(asc(schema.address.createdAt), asc(schema.address.id));
  return rows.map((row) => toEntry(row, defaults));
}

/** `User.defaultShippingAddress` / `User.defaultBillingAddress`, or null. */
export async function getUserDefaultAddress(
  db: Executor,
  userId: string,
  type: AddressType,
): Promise<AddressBookEntry | null> {
  const defaults = await defaultIds(db, userId);
  const addressId = type === "SHIPPING" ? defaults.shipping : defaults.billing;
  if (addressId === null) return null;
  const row = await findOwned(db, userId, addressId);
  return row ? toEntry(row, defaults) : null;
}

/**
 * Saleor's accountAddressCreate: validates the input, inserts the address, and with `type` makes it
 * the default of that type. At the limit, the oldest address that is not a default is replaced
 * (Saleor's remove_the_oldest_user_address_if_address_limit_is_reached).
 */
export async function createUserAddress(
  db: Executor,
  userId: string,
  input: AddressInput,
  type: AddressType | null = null,
): Promise<AddressBookResult> {
  const cleaned = cleanAddress(input);
  if (!cleaned.ok) return { ok: false, errors: toErrors(cleaned.errors) };

  return db.transaction(async (tx) => {
    if ((await countUserAddresses(tx, userId)) >= MAX_USER_ADDRESSES) {
      await removeOldestNonDefault(tx, userId);
    }
    const [row] = await tx
      .insert(schema.address)
      .values({ userId, ...cleaned.address })
      .returning();
    if (!row) throw new Error("address insert returned no row");
    if (type !== null) await setDefault(tx, userId, row.id, type);
    return { ok: true, address: toEntry(row, await defaultIds(tx, userId)) };
  });
}

/**
 * Saleor's accountAddressUpdate: a partial update. Fields left out keep their value; the merged
 * address is validated again with cleanAddress.
 */
export async function updateUserAddress(
  db: Executor,
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<AddressBookResult> {
  return db.transaction(async (tx) => {
    const row = await findOwned(tx, userId, addressId);
    if (!row) return { ok: false, errors: [addressNotFoundError()] };

    const cleaned = cleanAddress({ ...textOf(row), ...input });
    if (!cleaned.ok) return { ok: false, errors: toErrors(cleaned.errors) };

    const [updated] = await tx
      .update(schema.address)
      .set({ ...cleaned.address, updatedAt: sql`now()` })
      .where(and(eq(schema.address.id, addressId), eq(schema.address.userId, userId)))
      .returning();
    if (!updated) throw new Error("address update returned no row");
    return { ok: true, address: toEntry(updated, await defaultIds(tx, userId)) };
  });
}

/**
 * Saleor's accountAddressDelete. A deleted default is cleared by the foreign key, so the payload
 * keeps the flags the row had when it existed.
 */
export async function deleteUserAddress(
  db: Executor,
  userId: string,
  addressId: string,
): Promise<AddressBookResult> {
  return db.transaction(async (tx) => {
    const row = await findOwned(tx, userId, addressId);
    if (!row) return { ok: false, errors: [addressNotFoundError()] };
    const entry = toEntry(row, await defaultIds(tx, userId));
    await tx
      .delete(schema.address)
      .where(and(eq(schema.address.id, addressId), eq(schema.address.userId, userId)));
    return { ok: true, address: entry };
  });
}

/** Saleor's accountSetDefaultAddress, limited to the caller's own address book. */
export async function setDefaultUserAddress(
  db: Executor,
  userId: string,
  addressId: string,
  type: AddressType,
): Promise<AddressBookDefaultResult> {
  return db.transaction(async (tx) => {
    if (!(await findOwned(tx, userId, addressId))) {
      return { ok: false, errors: [addressNotFoundError()] };
    }
    await setDefault(tx, userId, addressId, type);
    return { ok: true };
  });
}

/** All address fields equal, as Saleor's `user.addresses.filter(**address_data)`. */
const sameAddress = (address: Address) =>
  and(
    eq(schema.address.firstName, address.firstName),
    eq(schema.address.lastName, address.lastName),
    eq(schema.address.companyName, address.companyName),
    eq(schema.address.streetAddress1, address.streetAddress1),
    eq(schema.address.streetAddress2, address.streetAddress2),
    eq(schema.address.city, address.city),
    eq(schema.address.cityArea, address.cityArea),
    eq(schema.address.postalCode, address.postalCode),
    eq(schema.address.country, address.country),
    eq(schema.address.countryArea, address.countryArea),
    eq(schema.address.phone, address.phone),
  );

/**
 * Saleor's store_user_address: adds the checkout's address to the user's book, reusing an
 * identical row, and sets it as that type's default only when the user has none. Skipped when the
 * book is full. Called in the checkout completion's transaction.
 */
async function storeUserAddress(
  db: Executor,
  userId: string,
  address: Address,
  type: AddressType,
): Promise<void> {
  if ((await countUserAddresses(db, userId)) >= MAX_USER_ADDRESSES) return;

  const [existing] = await db
    .select({ id: schema.address.id })
    .from(schema.address)
    .where(and(eq(schema.address.userId, userId), sameAddress(address)));
  let addressId = existing?.id;
  if (addressId === undefined) {
    const [inserted] = await db
      .insert(schema.address)
      .values({ userId, ...address })
      .returning({ id: schema.address.id });
    if (!inserted) throw new Error("address insert returned no row");
    addressId = inserted.id;
  }

  const defaults = await defaultIds(db, userId);
  const current = type === "SHIPPING" ? defaults.shipping : defaults.billing;
  if (current === null) await setDefault(db, userId, addressId, type);
}

/** Saleor's store_user_address for both checkout addresses; either may be absent. */
export async function storeUserAddresses(
  db: Executor,
  userId: string,
  addresses: { shipping: Address | null; billing: Address | null },
): Promise<void> {
  if (addresses.shipping !== null) {
    await storeUserAddress(db, userId, addresses.shipping, "SHIPPING");
  }
  if (addresses.billing !== null) {
    await storeUserAddress(db, userId, addresses.billing, "BILLING");
  }
}
