// Adapted from saleor-dashboard: src/components/AppLayout/TopNav/destinationIcons.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Each destination's icon is added with its first page; categories → FolderTree (taxonomy),
// customers → User, modeling → Saleor's own mark (the sidebar group's icon).
import type { LucideIcon } from "lucide-react";
import { FolderTree, User } from "lucide-react";
import { ModelingIcon } from "../../../modeling/components/ModelingIcon/ModelingIcon";
import { topNavLucideIconProps } from "../../icons";

const createTopNavLucideIcon = (Icon: LucideIcon): (() => React.ReactNode) => {
  const TopNavLucideIcon = (): React.ReactNode => <Icon {...topNavLucideIconProps} />;

  return TopNavLucideIcon;
};

export const TopNavDestinationIcon = {
  categories: createTopNavLucideIcon(FolderTree),
  customers: createTopNavLucideIcon(User),
  modeling: ModelingIcon,
};
