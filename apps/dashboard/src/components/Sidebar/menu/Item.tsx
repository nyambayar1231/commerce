// Adapted from saleor-dashboard: src/components/Sidebar/menu/Item.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor also renders "divider" items (extension headers); our menu has none.
import { ItemGroup } from "./ItemGroup";
import { SingleItem } from "./SingleItem";
import type { SidebarMenuItem } from "./types";

interface Props {
  menuItem: SidebarMenuItem;
}

export const MenuItem = (props: Props) => {
  const { menuItem } = props;

  switch (menuItem.type) {
    case "item":
      return <SingleItem {...props} />;
    case "itemGroup":
      return <ItemGroup {...props} />;
    case "divider":
      return null;
  }
};
