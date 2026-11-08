// Adapted from saleor-dashboard: src/components/Sidebar/sidebarCollapseMessages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { defineMessages } from "react-intl";

export const sidebarCollapseMessages = defineMessages({
  collapseNavigation: {
    id: "ng7bVJ",
    defaultMessage: "Collapse navigation",
    description: "button and tooltip, shrinks the main nav to an icon rail",
  },
  expandNavigation: {
    id: "YmHxaH",
    defaultMessage: "Expand navigation",
    description: "button and tooltip, restores the full main nav from the icon rail",
  },
  accountMenu: {
    id: "hlsvPO",
    defaultMessage: "Account menu",
    description: "aria-label, avatar button opening the account menu in the collapsed main nav",
  },
});
