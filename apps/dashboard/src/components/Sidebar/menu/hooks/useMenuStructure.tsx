// Adapted from saleor-dashboard: src/components/Sidebar/menu/hooks/useMenuStructure.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { useIntl } from "react-intl";

import { ConfigurationIcon } from "../../../../icons/Configuration";
import { CustomersIcon } from "../../../../icons/Customers";
import { HomeIcon } from "../../../../icons/Home";
import { OrdersIcon } from "../../../../icons/Orders";
import { ProductsIcon } from "../../../../icons/Products";
import { sectionNames } from "../../../../intl";
import { SidebarIconSlot } from "../../SidebarIconSlot";
import type { SidebarMenuItem } from "../types";

// Saleor's menu, limited to the sections on our roadmap (PLAN.md M0.3.5). Ids, urls, icons and
// labels are Saleor's. Orders and Customers are plain items: in Saleor they are groups whose
// children (draft orders, customer types) we don't build. Saleor also filters items by the
// user's permissions; that returns with permissions (M1.2).
export function useMenuStructure(): SidebarMenuItem[] {
  const intl = useIntl();

  return [
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
          type: "item",
        },
        {
          label: intl.formatMessage(sectionNames.categories),
          id: "categories",
          url: "/categories/",
          type: "item",
        },
      ],
      icon: renderIcon(<ProductsIcon />),
      url: "/products/",
      label: intl.formatMessage(sectionNames.catalog),
      id: "products",
      type: "itemGroup",
    },
    {
      icon: renderIcon(<OrdersIcon />),
      label: intl.formatMessage(sectionNames.orders),
      id: "orders",
      url: "/orders/",
      type: "item",
    },
    {
      icon: renderIcon(<CustomersIcon />),
      label: intl.formatMessage(sectionNames.customers),
      id: "customers",
      url: "/customers/",
      type: "item",
    },
    {
      icon: renderIcon(<ConfigurationIcon />),
      label: intl.formatMessage(sectionNames.configuration),
      id: "configure",
      url: "/configuration/",
      type: "item",
    },
  ];
}

function renderIcon(icon: React.ReactNode) {
  return <SidebarIconSlot>{icon}</SidebarIconSlot>;
}
