// Adapted from saleor-dashboard: src/theme/hook.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import { type DefaultTheme, useTheme as useMacawTheme } from "@saleor/macaw-ui";

import useLocalStorage from "../hooks/useLocalStorage";
import { defaultTheme, localStorageKey } from "./consts";

export const useTheme = () => {
  const { theme, setTheme } = useMacawTheme();
  const [, setActiveTheme] = useLocalStorage<DefaultTheme>(localStorageKey, defaultTheme);

  return {
    theme,
    setTheme: (to: DefaultTheme) => {
      setActiveTheme(to);
      setTheme(to);
    },
  };
};
