// Stands in for Saleor's useSidebarLogo (src/components/Sidebar/useSidebarLogo.ts): instead of a
// logo image, the header, rail and app bar show the shop's initials (owner decision, PLAN.md
// M0.3.5). Saleor's header says "Saleor Dashboard"; ours shows the shop name, and "Dashboard"
// until it loads or if the API can't be reached.
import { useIntl } from "react-intl";

import { commonMessages } from "../../intl";
import { useShop } from "../Shop";

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

export const useSidebarBrand = (): { title: string; initials: string } => {
  const intl = useIntl();
  const shop = useShop();
  const title = shop?.name ?? intl.formatMessage(commonMessages.dashboard);

  return { title, initials: getInitials(title) };
};
