// Adapted from saleor-dashboard: src/components/Sidebar/user/ThemeSwitcher.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { type DefaultTheme, Text } from "@saleor/macaw-ui";
import { Moon, Sun } from "lucide-react";
import { FormattedMessage } from "react-intl";

import { iconSize, iconStrokeWidthBySize } from "../../icons";

export const ThemeSwitcher = ({ theme }: { theme: DefaultTheme }): React.ReactNode => {
  if (theme === "defaultLight") {
    return (
      <>
        <Moon size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
        <Text>
          <FormattedMessage id="5ObBlW" defaultMessage="Dark Mode" />
        </Text>
      </>
    );
  }

  return (
    <>
      <Sun size={iconSize.small} strokeWidth={iconStrokeWidthBySize.small} />
      <Text>
        <FormattedMessage id="hVPucN" defaultMessage="Light Mode" />
      </Text>
    </>
  );
};
