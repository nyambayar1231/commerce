// Our own small replacement for Saleor's `qs` dependency (the dashboard has none). It reads and
// writes exactly the conditional-filter query strings we produce, Saleor's indexed entries:
//
//   0[s0.isPublished]=false
//   1=AND
//   2[s2.category][0]=UHJvZHVjdENhdGVnb3J5OjE&2[s2.category][1]=...
//   3[s4.updatedAt]=2024-01-01
//
// `qs.parse` turns those into an object keyed by the index, whose value is either the literal
// separator string or `{ "s2.category": ["id", "id"] }`; this module returns the same structure
// directly. Keys that are not one of our entries (search, sort, deep nesting) are ignored.
import { UrlEntry } from "../UrlToken";
import type { Structure } from "../utils";

export type FilterQueryEntry = [string, string];

const ENTRY_KEY = /^(\d+)(?:\[([^[\]]+)\](?:\[(\d+)\])?)?$/;

interface IndexedEntry {
  text?: string;
  values: Map<string, string | string[]>;
}

/** URL query string → `[separator | UrlEntry, …]`, the shape `qs.parse` gives Saleor. */
export const parseFilterQuery = (search: string): Structure => {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const indexed = new Map<number, IndexedEntry>();

  for (const [key, value] of params) {
    const match = ENTRY_KEY.exec(key);

    if (!match) {
      continue;
    }

    const index = Number(match[1]);
    const entry = indexed.get(index) ?? { values: new Map<string, string | string[]>() };
    const token = match[2];

    if (token === undefined) {
      entry.text = value;
      indexed.set(index, entry);
      continue;
    }

    const item = match[3];

    if (item === undefined) {
      entry.values.set(token, value);
    } else {
      const existing = entry.values.get(token);
      const values = Array.isArray(existing) ? existing : [];
      values[Number(item)] = value;
      entry.values.set(token, values);
    }

    indexed.set(index, entry);
  }

  return [...indexed.keys()]
    .sort((a, b) => a - b)
    .flatMap((index): Structure => {
      const entry = indexed.get(index);

      if (!entry) {
        return [];
      }

      const structure: Structure = entry.text === undefined ? [] : [entry.text];

      for (const [key, value] of entry.values) {
        structure.push(new UrlEntry(key, value));
      }

      return structure;
    });
};

/** `[separator | UrlEntry, …]` → the `[key, value]` pairs of the query string. */
export const filterQueryEntries = (structure: Structure): FilterQueryEntry[] => {
  const entries: FilterQueryEntry[] = [];

  structure.forEach((item, index) => {
    if (typeof item === "string") {
      entries.push([String(index), item]);
      return;
    }

    for (const [key, value] of Object.entries(
      item as unknown as Record<string, string | string[]>,
    )) {
      if (Array.isArray(value)) {
        value.forEach((entry, position) => {
          entries.push([`${index}[${key}][${position}]`, entry]);
        });
      } else {
        entries.push([`${index}[${key}]`, value]);
      }
    }
  });

  return entries;
};

export const stringifyFilterQuery = (structure: Structure): string =>
  new URLSearchParams(filterQueryEntries(structure)).toString();
