// Adapted from saleor-dashboard: src/components/Sidebar/menu/RailMenuItem.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md

import { Box } from "@saleor/macaw-ui";
import { Circle } from "lucide-react";
import { Link } from "react-router";
import { navigationLucideIconProps } from "../../icons";

import { SidebarIconSlot } from "../SidebarIconSlot";
import { useIsMenuActive } from "./hooks/useIsMenuActive";
import { RailGroup } from "./RailGroup";
import { RailItem } from "./RailItem";
import type { SidebarMenuItem } from "./types";

interface RailMenuItemProps {
  menuItem: SidebarMenuItem;
}

const RailLink = ({ menuItem, icon }: RailMenuItemProps & { icon: React.ReactNode }) => {
  const active = useIsMenuActive(menuItem);

  return (
    <RailItem
      label={menuItem.label}
      icon={icon}
      active={active}
      adornment={menuItem.endAdornment}
      dataTestId={`menu-item-label-${menuItem.id}`}
    >
      {(content) => (
        <Link
          to={menuItem.url ?? ""}
          replace={active}
          onClick={menuItem.onClick}
          aria-current={active ? "page" : undefined}
        >
          {content}
        </Link>
      )}
    </RailItem>
  );
};

export const RailMenuItem = ({ menuItem }: RailMenuItemProps) => {
  const icon = menuItem.icon ?? (
    <SidebarIconSlot>
      <Circle {...navigationLucideIconProps} />
    </SidebarIconSlot>
  );

  switch (menuItem.type) {
    case "item":
      return <RailLink menuItem={menuItem} icon={icon} />;
    case "itemGroup":
      return <RailGroup menuItem={menuItem} icon={icon} />;
    case "divider":
      return (
        <Box
          as="li"
          aria-hidden
          marginY={1}
          borderTopWidth={1}
          borderTopStyle="solid"
          borderColor="default1"
        />
      );
    default: {
      const exhaustive: never = menuItem.type;

      return exhaustive;
    }
  }
};
