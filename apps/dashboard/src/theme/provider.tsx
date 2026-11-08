// Adapted from saleor-dashboard: src/theme/provider.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { type DefaultTheme, ThemeProvider as MacawThemeProvider } from "@saleor/macaw-ui";
import type { ReactNode } from "react";

import { defaultTheme, localStorageKey } from "./consts";

// Saleor reads this through its useLocalStorage hook; the hook arrives with the theme
// switcher (M0.3.9). Until then the stored value is only read, never written.
function readStoredTheme(): DefaultTheme {
  const stored = localStorage.getItem(localStorageKey);
  return stored === "defaultLight" || stored === "defaultDark" ? stored : defaultTheme;
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return <MacawThemeProvider defaultTheme={readStoredTheme()}>{children}</MacawThemeProvider>;
};
