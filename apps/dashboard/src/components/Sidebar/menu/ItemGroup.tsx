// Adapted from saleor-dashboard: src/components/Sidebar/menu/ItemGroup.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { Box, List, sprinkles, Text } from "@saleor/macaw-ui";
import { useCallback } from "react";
import { defineMessage, useIntl } from "react-intl";
import { Link, useLocation } from "react-router";

import { SubmenuItems } from "./SubmenuItems";
import type { SidebarMenuItem } from "./types";
import { isMenuActive } from "./utils";

interface Props {
  menuItem: SidebarMenuItem;
}

// Ours, not Saleor's: Saleor leaves the expand chevron without an accessible name.
const submenuMessage = defineMessage<{ section: string }>({
  id: "jvlQkk",
  defaultMessage: "{section} submenu",
  description: "aria-label, button expanding or collapsing a sidebar menu group",
});

export const ItemGroup = ({ menuItem }: Props) => {
  const location = useLocation();
  const intl = useIntl();
  const submenuLabel = intl.formatMessage(submenuMessage, {
    section: typeof menuItem.label === "string" ? menuItem.label : menuItem.id,
  });
  // Macaw renders the chevron (a Radix accordion trigger) right after the box holding our link and
  // takes no props for it, so it is named through the DOM, as SidebarDrawer names Macaw's close
  // button. Radix already sets aria-expanded on it.
  const nameChevron = useCallback(
    (link: HTMLAnchorElement | null) => {
      const chevron = link?.parentElement?.nextElementSibling;

      if (chevron instanceof HTMLButtonElement) {
        chevron.setAttribute("aria-label", submenuLabel);
      }
    },
    [submenuLabel],
  );

  // Saleor keeps the search for navigation pins; we have none, but it is harmless.
  const activeLocation = location.pathname + location.search;
  const hasSubmenuActive = (menuItem.children ?? []).some((item) =>
    isMenuActive(activeLocation, item),
  );
  const isActive = isMenuActive(activeLocation, menuItem) && !hasSubmenuActive;
  const isExpanded = isActive || hasSubmenuActive || Boolean(menuItem.defaultExpanded);

  const handleMenuGroupClick = () => {
    if (menuItem.onClick) {
      menuItem.onClick();
    }
  };

  return (
    <List.ItemGroup defaultExpanded={isExpanded} data-test-id={`menu-list-item`}>
      <List.ItemGroup.Trigger
        paddingX={2}
        paddingRight={1}
        borderRadius={3}
        size="small"
        active={isActive}
        justifyContent="space-between"
        data-test-id={`menu-item-label-${menuItem.id}`}
        position="relative"
        onClick={handleMenuGroupClick}
        className="sidebar-item-group-trigger"
      >
        <Link
          ref={nameChevron}
          replace={isActive}
          aria-current={isActive ? "page" : undefined}
          to={menuItem?.url ?? ""}
          className={sprinkles({
            width: "100%",
            display: "block",
          })}
        >
          <Box display="flex" alignItems="center" gap={3} paddingY={1.5} borderRadius={3}>
            {menuItem.icon}
            <Text size={3} fontWeight="medium">
              {menuItem.label}
            </Text>
            {menuItem.endAdornment && <Box>{menuItem.endAdornment}</Box>}
          </Box>
        </Link>
      </List.ItemGroup.Trigger>
      <List.ItemGroup.Content>
        <Box
          borderLeftWidth={1}
          borderLeftStyle="solid"
          borderColor="default1"
          paddingLeft={4}
          marginLeft={4}
          display="flex"
          flexDirection="column"
          marginBottom={2}
          marginTop={1}
          gap="px"
        >
          <SubmenuItems items={menuItem.children ?? []} />
        </Box>
      </List.ItemGroup.Content>
    </List.ItemGroup>
  );
};
