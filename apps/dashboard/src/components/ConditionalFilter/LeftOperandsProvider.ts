// Adapted from saleor-dashboard: src/components/ConditionalFilter/LeftOperandsProvider.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The fields the "add condition" list offers. Saleor's attribute entity types and the settable
// provider are dropped: our product fields are static and known at compile time.
export interface LeftOperand {
  value: string;
  label: string;
  type: string;
  slug: string;
  maxOccurrences?: number;
}

export interface LeftOperandsProvider {
  operands: LeftOperand[];
}
