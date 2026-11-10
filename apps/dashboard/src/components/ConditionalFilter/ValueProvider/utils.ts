// Adapted from saleor-dashboard: src/components/ConditionalFilter/ValueProvider/utils.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Turns a filter container into the serializable structure the URL query string is built from,
// and compares containers by that structure.
import type { FilterContainer } from "../FilterElement/FilterElement";
import type { UrlEntry } from "./UrlToken";

export type Structure = Array<string | UrlEntry>;

export const prepareStructure = (filterValue: FilterContainer): Structure =>
  filterValue.map((f) => (typeof f === "string" ? f : f.asUrlEntry()));

export const getFilterContainerKey = (filterValue: FilterContainer): string =>
  JSON.stringify(prepareStructure(filterValue));

export const areFilterContainersEqual = (left: FilterContainer, right: FilterContainer): boolean =>
  getFilterContainerKey(left) === getFilterContainerKey(right);

/**
 * Working rows and the URL provider share FilterElement instances, so an in-place edit changes
 * both sides of `areFilterContainersEqual`. Compare against a serialized snapshot instead.
 */
export const hasUnsavedFilterChanges = (current: FilterContainer, committedKey: string): boolean =>
  getFilterContainerKey(current) !== committedKey;
