// Adapted from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/TokenArray/index.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's TokenArray, reduced: no attribute tokens, and no Array subclass. Invalid entries are
// skipped, never thrown. `asFilterValuesFromResponse` is what fills the names of the categories a
// reloaded URL selected; without a response, values stay the raw URL strings.
import type { InitialStateResponse } from "../../API/initialState/InitialStateResponse";
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
    return this.toFilterContainer();
  }

  /** The same rows, with the loaded labels (category names, status names) in place of raw URL values. */
  public asFilterValuesFromResponse(response: InitialStateResponse): FilterContainer {
    return this.toFilterContainer(response);
  }

  /** The async values the URL names, by field: only the category picker has any. */
  public getFetchingParams(): { category: string[] } {
    const category: string[] = [];

    for (const entry of this.entries) {
      if (typeof entry === "string") continue;

      const token = UrlToken.fromUrlEntry(entry);

      if (!token?.isStatic() || token.name !== "category") continue;

      const values = Array.isArray(token.value) ? token.value : [token.value];

      for (const value of values) {
        if (value.length > 0 && !category.includes(value)) category.push(value);
      }
    }

    return { category };
  }

  private toFilterContainer(response?: InitialStateResponse): FilterContainer {
    const container: FilterContainer = [];

    for (const entry of this.entries) {
      if (typeof entry === "string") {
        container.push(entry);
        continue;
      }

      const token = UrlToken.fromUrlEntry(entry);
      const element = token ? FilterElement.fromUrlToken(token, response) : null;

      if (element) {
        container.push(element);
      }
    }

    return container;
  }
}

export const parseFilterContainer = (search: string): FilterContainer =>
  new TokenArray(search).asFilterContainer();
