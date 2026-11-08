// Adapted from saleor-dashboard: src/icons/createNavigationLucideIcon.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { LucideIcon } from "lucide-react";

import { navigationLucideIconProps } from "../components/icons";

export const createNavigationLucideIcon = (Icon: LucideIcon): (() => React.ReactNode) => {
  const NavigationLucideIcon = (): React.ReactNode => <Icon {...navigationLucideIconProps} />;

  return NavigationLucideIcon;
};
