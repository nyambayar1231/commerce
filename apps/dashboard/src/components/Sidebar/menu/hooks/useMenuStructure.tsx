// Adapted from saleor-dashboard: src/components/Sidebar/menu/hooks/useMenuStructure.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useIntl } from "react-intl";

import { useUser } from "../../../../auth/AuthProvider";
import type { PermissionEnum } from "../../../../graphql/types.generated";
import { ConfigurationIcon } from "../../../../icons/Configuration";
import { CustomersIcon } from "../../../../icons/Customers";
import { HomeIcon } from "../../../../icons/Home";
import { OrdersIcon } from "../../../../icons/Orders";
import { ProductsIcon } from "../../../../icons/Products";
import { sectionNames } from "../../../../intl";
import { SidebarIconSlot } from "../../SidebarIconSlot";
import type { SidebarMenuItem } from "../types";
import { filterMenuItemsByPermissions } from "../utils";

// The codes of the configuration pages on our roadmap (staff members / permission groups, site
// settings, shipping). Saleor computes this from its configuration menu; we hardcode it until
// those pages exist. Used by both the sidebar item and the /configuration route (App.tsx).
export const CONFIGURATION_PERMISSIONS: PermissionEnum[] = [
  "MANAGE_STAFF",
  "MANAGE_SETTINGS",
  "MANAGE_SHIPPING",
];

// Saleor's menu, limited to the sections on our roadmap (PLAN.md M0.3.5). Ids, urls, icons and
// labels are Saleor's. Orders and Customers are plain items: in Saleor they are groups whose
// children (draft orders, customer types) we don't build. Items are filtered by the user's
// permissions exactly as Saleor filters them (utils.ts).
export function useMenuStructure(): SidebarMenuItem[] {
  const intl = useIntl();
  const { user } = useUser();

  const menuItems: SidebarMenuItem[] = [
    {
      icon: renderIcon(<HomeIcon />),
      label: intl.formatMessage(sectionNames.home),
      id: "home",
      url: "/home",
      type: "item",
    },
    {
      children: [
        {
          label: intl.formatMessage(sectionNames.products),
          id: "products",
          url: "/products/",
          permissions: ["MANAGE_PRODUCTS"],
          type: "item",
        },
        {
          label: intl.formatMessage(sectionNames.categories),
          id: "categories",
          url: "/categories/",
          permissions: ["MANAGE_PRODUCTS"],
          type: "item",
        },
      ],
      icon: renderIcon(<ProductsIcon />),
      url: "/products/",
      label: intl.formatMessage(sectionNames.catalog),
      permissions: ["MANAGE_PRODUCTS"],
      id: "products",
      type: "itemGroup",
    },
    {
      icon: renderIcon(<OrdersIcon />),
      label: intl.formatMessage(sectionNames.orders),
      id: "orders",
      url: "/orders/",
      permissions: ["MANAGE_ORDERS"],
      type: "item",
    },
    {
      icon: renderIcon(<CustomersIcon />),
      label: intl.formatMessage(sectionNames.customers),
      id: "customers",
      url: "/customers/",
      // As Saleor: any-of, so users with only MANAGE_ORDERS or MANAGE_STAFF can still open
      // the customers section (edit affordances inside it stay gated by the server).
      permissions: ["MANAGE_USERS", "MANAGE_ORDERS", "MANAGE_STAFF"],
      type: "item",
    },
    {
      icon: renderIcon(<ConfigurationIcon />),
      label: intl.formatMessage(sectionNames.configuration),
      id: "configure",
      url: "/configuration/",
      permissions: CONFIGURATION_PERMISSIONS,
      type: "item",
    },
  ];

  return filterMenuItemsByPermissions(
    menuItems,
    (user?.userPermissions ?? []).map((permission) => permission.code),
  );
}

function renderIcon(icon: React.ReactNode) {
  return <SidebarIconSlot>{icon}</SidebarIconSlot>;
}
