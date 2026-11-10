import type { Executor, schema } from "@commerce/db";
import { and, eq, ne, sql } from "drizzle-orm";

// unidecode's Cyrillic mappings used by Saleor. Uppercase characters use the same mapping;
// Django's slugify lowercases the transliterated value afterwards.
const CYRILLIC: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "io",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  ө: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ү: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "'",
  э: "e",
  ю: "iu",
  я: "ia",
};

/** Saleor's slugify(unidecode(value)), for Mongolian and Russian category names. */
export function slugify(value: string): string {
  const transliterated = value.replace(
    /[А-Яа-яЁёӨөҮү]/g,
    (character) => CYRILLIC[character] ?? CYRILLIC[character.toLowerCase()] ?? character,
  );
  const slug = transliterated
    .normalize("NFKD")
    // Django drops every non-ASCII character after normalisation.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: the full ASCII range is intentional
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return slug || "-";
}

/** The tables whose `slug` column is unique and gets a generated suffix (categories, products). */
type SlugTable = typeof schema.category | typeof schema.product;

export async function slugTaken(
  db: Executor,
  table: SlugTable,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(exceptId ? and(eq(table.slug, slug), ne(table.id, exceptId)) : eq(table.slug, slug));
  return row !== undefined;
}

/** Saleor's generate_unique_slug + prepare_unique_slug. */
export async function generateUniqueSlug(
  db: Executor,
  table: SlugTable,
  name: string,
): Promise<string> {
  const base = slugify(name);
  const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rows = await db
    .select({ slug: table.slug })
    .from(table)
    .where(sql`${table.slug} ~* ${`^${escapedBase}(-[0-9]+)?$`}`);
  const existing = new Set(rows.map((row) => row.slug.toLowerCase()));

  if (!existing.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
}
