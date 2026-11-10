// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/index.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { AddRowButton, ClearButton, CloseButton, ConfirmButton, Footer } from "./Footer";
import { Root } from "./Root";

export { isFlatFilterLayout } from "./filterLayout";
export type { ConditionalFiltersLayout } from "./Root";
export type { FilterEvent, Row } from "./types";

export const Filters = Object.assign(Root, {
  AddRowButton,
  ConfirmButton,
  ClearButton,
  CloseButton,
  Footer,
});
