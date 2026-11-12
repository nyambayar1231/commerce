// Adapted from saleor-dashboard: src/customers/components/CustomerDetailsPage/messages.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Without the GraphiQL, metadata, customer type and attribute messages.
import { defineMessages } from "react-intl";

export const messages = defineMessages({
  deleteUser: {
    id: "LQg8/p",
    defaultMessage: "Delete user",
    description: "customer detail cogs menu, opens the delete-confirmation dialog",
  },
  deactivateUser: {
    id: "zP3Rb6",
    defaultMessage: "Deactivate user",
    description: "customer detail cogs menu, deactivates the customer account",
  },
  activateUser: {
    id: "62Rs/K",
    defaultMessage: "Activate user",
    description: "customer detail cogs menu, activates a deactivated customer account",
  },
  saveCompositionGeneral: {
    id: "65MiSm",
    defaultMessage: "details",
    description: "Save composition segment for customer name, email, and note",
  },
});
