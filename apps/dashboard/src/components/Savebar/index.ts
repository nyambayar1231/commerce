// Adapted from saleor-dashboard: src/components/Savebar/index.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's ReadOnlyLabel comes when a read-only page needs it.
import { SavebarRoot, Spacer } from "./Savebar";
import { CancelButton, ConfirmButton, DeleteButton } from "./SavebarActionButtons";

export const Savebar = Object.assign(SavebarRoot, {
  Spacer,
  DeleteButton,
  ConfirmButton,
  CancelButton,
});
