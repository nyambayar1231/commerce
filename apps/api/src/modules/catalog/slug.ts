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
