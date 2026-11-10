// Adapted from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/TokenArray/index.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's TokenArray, reduced: no attribute tokens, no initial-state lookup (values come from
// the URL), and no Array subclass. Invalid entries are skipped, never thrown.
import { type FilterContainer, FilterElement } from "../../FilterElement/FilterElement";
import { UrlToken } from "../UrlToken";
import type { Structure } from "../utils";
import { parseFilterQuery } from "./queryString";

export { filterQueryEntries, parseFilterQuery, stringifyFilterQuery } from "./queryString";

export class TokenArray {
  private readonly entries: Structure;

  constructor(url: string) {
    this.entries = parseFilterQuery(url);
  }

  /** The filter rows and their `AND` separators; unsupported or invalid entries are left out. */
  public asFilterContainer(): FilterContainer {
    const container: FilterContainer = [];

    for (const entry of this.entries) {
      if (typeof entry === "string") {
        container.push(entry);
        continue;
      }

      const token = UrlToken.fromUrlEntry(entry);
      const element = token ? FilterElement.fromUrlToken(token) : null;

      if (element) {
        container.push(element);
      }
    }

    return container;
  }
}

export const parseFilterContainer = (search: string): FilterContainer =>
  new TokenArray(search).asFilterContainer();
