import { closeDb, getDb, schema } from "@commerce/db";
import { isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEMO_CATEGORIES, seedDemoCatalog } from "./demoCatalog.ts";

const db = getDb();

beforeEach(async () => {
  await db.$client.unsafe("TRUNCATE category CASCADE");
});

afterAll(async () => {
  await db.$client.unsafe("TRUNCATE category CASCADE");
  await closeDb();
});

type Node = { children?: Node[] };
const countNodes = (nodes: Node[]): number =>
  nodes.reduce((sum, node) => sum + 1 + countNodes(node.children ?? []), 0);

describe("seedDemoCatalog", () => {
  it("creates the demo tree, with more top-level categories than one 20-row page", async () => {
    const total = countNodes(DEMO_CATEGORIES);
    expect(await seedDemoCatalog(db)).toEqual({ created: total, skipped: 0 });

    const roots = await db.select().from(schema.category).where(isNull(schema.category.parentId));
    expect(roots.length).toBeGreaterThan(20);
    expect(await db.select().from(schema.category)).toHaveLength(total);
  });

  it("is safe to run again", async () => {
    await seedDemoCatalog(db);
    const total = countNodes(DEMO_CATEGORIES);
    expect(await seedDemoCatalog(db)).toEqual({ created: 0, skipped: total });
    expect(await db.select().from(schema.category)).toHaveLength(total);
  });

  it("keeps a category that already exists and fills in its missing children", async () => {
    await db.insert(schema.category).values({ name: "Гутал", slug: "gutal" });
    const result = await seedDemoCatalog(db);
    expect(result.skipped).toBe(1);
    expect(await db.select().from(schema.category)).toHaveLength(countNodes(DEMO_CATEGORIES));
  });
});
