// Stands in for Saleor's useSidebarLogo (src/components/Sidebar/useSidebarLogo.ts): instead of a
// logo image, the header, rail and app bar show initials (owner decision, PLAN.md M0.3.5).
// The title becomes the shop name in M0.3.10.
import { useIntl } from "react-intl";

import { commonMessages } from "../../intl";

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

export const useSidebarBrand = (): { title: string; initials: string } => {
  const intl = useIntl();
  const title = intl.formatMessage(commonMessages.dashboard);

  return { title, initials: getInitials(title) };
};
