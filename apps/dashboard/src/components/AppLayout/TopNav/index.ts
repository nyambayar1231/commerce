// Adapted from saleor-dashboard: src/components/AppLayout/TopNav/index.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's TopNav.MetadataButton comes with metadata.
import { TopNavDestinationIcon } from "./destinationIcons";
import { topNavDestinationMessages } from "./destinationMessages";
import { Menu } from "./Menu";
import { Root } from "./Root";

export { TopNavDestinationIcon, topNavDestinationMessages };

export const TopNav = Object.assign(Root, {
  Menu,
});
