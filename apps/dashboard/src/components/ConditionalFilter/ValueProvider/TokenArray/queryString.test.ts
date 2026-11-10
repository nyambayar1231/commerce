// Our tests for the small conditional-filter query-string parser/serializer that replaces `qs`.
import { describe, expect, it } from "vitest";

import { UrlEntry } from "../UrlToken";
import { filterQueryEntries, parseFilterQuery, stringifyFilterQuery } from "./queryString";

/** Both sides go through URLSearchParams, so bracket encoding is compared like with like. */
const normalized = (search: string) => new URLSearchParams(search).toString();

describe("conditional filter query string", () => {
  it("reads Saleor's indexed entries", () => {
    const structure = parseFilterQuery(
      "0[s0.price]=123&1=AND&2[s2.category][0]=cat-1&2[s2.category][1]=cat-2",
    );

    expect(structure).toEqual([
      new UrlEntry("s0.price", "123"),
      "AND",
      new UrlEntry("s2.category", ["cat-1", "cat-2"]),
    ]);
  });

  it("ignores params that are not filter entries", () => {
    expect(parseFilterQuery("sort=name&asc=true&query=boots")).toEqual([]);
    expect(parseFilterQuery("0[1][s0.price]=1")).toEqual([]);
  });

  it("round-trips Saleor's example URLs for every shape we use", () => {
    const examples = [
      "0[s0.isPublished]=false",
      "0[s0.price]=123&1=AND&2[s2.category][0]=accessories&2[s2.category][1]=groceries",
      "0[s4.updatedAt]=2024-01-01&1=AND&2[s3.updatedAt][0]=2024-01-01&2[s3.updatedAt][1]=2024-12-31",
    ];

    for (const example of examples) {
      expect(stringifyFilterQuery(parseFilterQuery(example))).toBe(normalized(example));
    }
  });

  it("serializes arrays with an index per value", () => {
    expect(filterQueryEntries([new UrlEntry("s2.category", ["cat-1", "cat-2"]), "AND"])).toEqual([
      ["0[s2.category][0]", "cat-1"],
      ["0[s2.category][1]", "cat-2"],
      ["1", "AND"],
    ]);
  });
});
