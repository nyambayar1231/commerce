"use client";

import type { SelectHTMLAttributes } from "react";

// Adapted from saleor-storefront: src/ui/components/plp/filter-bar.tsx (FSL-1.1-ALv2, Copyright 2026 Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

type AutoSubmitSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * A native `<select>` that submits its `<form method="get">` on change, so choosing a filter or
 * a sort navigates immediately. Without JavaScript the same form still submits through its
 * apply button: one control, both worlds (ARCHITECTURE §10.7: works without JavaScript).
 */
export function AutoSubmitSelect(props: AutoSubmitSelectProps) {
  return (
    <select
      {...props}
      onChange={(event) => {
        event.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
