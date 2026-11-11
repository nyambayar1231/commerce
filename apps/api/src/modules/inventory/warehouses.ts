import { type Executor, schema } from "@commerce/db";
import { asc, desc, eq, type SQL, sql } from "drizzle-orm";

// Saleor's `warehouse` and `warehouses` reads (saleor/graphql/warehouse/resolvers.py). One row is
// seeded by the migration (ADR-0005); warehouses are ordered by name, then id so pages never
// overlap or skip rows.

export type WarehouseRow = typeof schema.warehouse.$inferSelect;

export async function getWarehouse(db: Executor, id: string): Promise<WarehouseRow | null> {
  const [row] = await db.select().from(schema.warehouse).where(eq(schema.warehouse.id, id));
  return row ?? null;
}

export interface WarehouseListArgs {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

export interface WarehousePage {
  rows: { cursor: string; node: WarehouseRow }[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalCount: number;
}

/** Cursor problems are the client's fault; the GraphQL layer reports them as Saleor does. */
export class InvalidCursorError extends Error {
  constructor() {
    super("Received cursor is invalid.");
    this.name = "InvalidCursorError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const encodeCursor = (row: WarehouseRow): string =>
  Buffer.from(JSON.stringify([row.name, row.id])).toString("base64");

function decodeCursor(cursor: string): [string, string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    throw new InvalidCursorError();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== "string" ||
    typeof parsed[1] !== "string" ||
    !UUID.test(parsed[1])
  ) {
    throw new InvalidCursorError();
  }
  return [parsed[0], parsed[1]];
}

export async function listWarehouses(
  db: Executor,
  args: WarehouseListArgs,
): Promise<WarehousePage> {
  const backwards = args.last != null;
  const limit = (backwards ? args.last : args.first) ?? 0;
  const cursor = backwards ? args.before : args.after;

  // Walking backwards reads the rows in reverse order, then flips them back.
  const ascending = !backwards;
  const direction = ascending ? asc : desc;
  let keyset: SQL | undefined;
  if (cursor) {
    const [name, id] = decodeCursor(cursor);
    keyset = ascending
      ? sql`(${schema.warehouse.name}, ${schema.warehouse.id}) > (${name}, ${id}::uuid)`
      : sql`(${schema.warehouse.name}, ${schema.warehouse.id}) < (${name}, ${id}::uuid)`;
  }

  const [pageRows, [countRow]] = await Promise.all([
    db
      .select()
      .from(schema.warehouse)
      .where(keyset)
      .orderBy(direction(schema.warehouse.name), direction(schema.warehouse.id))
      .limit(limit + 1),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.warehouse),
  ]);

  const hasMore = pageRows.length > limit;
  const page = pageRows.slice(0, limit);
  if (backwards) page.reverse();

  return {
    rows: page.map((node) => ({ cursor: encodeCursor(node), node })),
    // Like Saleor (and Relay's spec): the other direction is only known from the cursor's presence.
    hasNextPage: backwards ? Boolean(cursor) : hasMore,
    hasPreviousPage: backwards ? hasMore : Boolean(cursor),
    totalCount: countRow?.count ?? 0,
  };
}
