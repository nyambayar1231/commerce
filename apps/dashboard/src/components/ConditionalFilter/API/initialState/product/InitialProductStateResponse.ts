// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/initialState/product/InitialProductStateResponse.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The names of the categories named by the URL. Saleor keeps one lookup per async operand
// (attributes, channels, collections, product types…); category is our only one.
import type { ItemOption } from "../../../FilterElement/ConditionValue";
import type { UrlToken } from "../../../ValueProvider/UrlToken";
import type { InitialStateResponse } from "../InitialStateResponse";

export interface InitialProductState {
  category: ItemOption[];
}

export class InitialProductStateResponse implements InitialProductState, InitialStateResponse {
  constructor(public category: ItemOption[] = []) {}

  public static empty() {
    return new InitialProductStateResponse();
  }

  /**
   * The loaded options a URL token names. Saleor matches on the option's slug because its URL
   * holds slugs; our URL holds category global IDs, so the match is on the option's value.
   */
  public filterByUrlToken(token: UrlToken): ItemOption[] {
    if (token.name !== "category") {
      return [];
    }

    const values = Array.isArray(token.value) ? token.value : [token.value];

    return this.category.filter((option) => values.includes(option.value));
  }
}
