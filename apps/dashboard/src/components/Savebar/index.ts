// Adapted from saleor-dashboard: src/components/Savebar/index.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { SavebarRoot, Spacer } from "./Savebar";
import { CancelButton, ConfirmButton, DeleteButton } from "./SavebarActionButtons";
import { ReadOnlyLabel } from "./SavebarReadOnlyLabel";

export const Savebar = Object.assign(SavebarRoot, {
  Spacer,
  DeleteButton,
  ConfirmButton,
  CancelButton,
  ReadOnlyLabel,
});
