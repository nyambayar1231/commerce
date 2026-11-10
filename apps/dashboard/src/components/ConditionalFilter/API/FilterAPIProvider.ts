// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/FilterAPIProvider.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel's async-option source. Saleor also fetches attribute operands; our product fields are
// static, so the right-hand option list is the only thing fetched.
import type { FilterContainer } from "../FilterElement/FilterElement";
import type { FilterChoicesPage } from "./filterChoicesPage";

export type { FilterChoicesPage } from "./filterChoicesPage";

export interface FilterAPIProvider {
  fetchRightOptions: (
    position: string,
    value: FilterContainer,
    inputValue: string,
    after?: string | null,
  ) => Promise<FilterChoicesPage>;
}
