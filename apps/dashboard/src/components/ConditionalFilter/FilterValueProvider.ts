// Adapted from saleor-dashboard: src/components/ConditionalFilter/FilterValueProvider.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The applied filters, as the URL has them. Saleor's token lookup and persisted-element checks
// are dropped: nothing in our panel asks for them.
import type { FilterContainer } from "./FilterElement/FilterElement";

export interface FilterValueProvider {
  value: FilterContainer;
  loading: boolean;
  persist: (newValue: FilterContainer) => void;
  clear: () => void;
  count: number;
}
