// Adapted from saleor-dashboard: src/components/AssignWarehouseDialog/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's strings for the warehouse picker, with their ids. The search and loading messages are
// not needed: this dialog has no search and no pagination.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  title: {
    id: "mFC5Rq",
    defaultMessage: "Assign Warehouses",
  },
  confirm: {
    id: "N2IrpM",
    defaultMessage: "Confirm",
  },
  noWarehousesAvailable: {
    id: "vaFjs6",
    defaultMessage: "No warehouses available to add",
  },
});
