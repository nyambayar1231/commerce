// Adapted from saleor-dashboard: src/components/Datagrid/styles.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The grid's Glide theme, from Macaw's theme values, as Saleor's useDatagridTheme. Saleor's class
// styles (legacy macaw-ui `makeStyles`, which we don't ship) are in Datagrid.module.css.
import type { Theme } from "@glideapps/glide-data-grid";
import { useTheme } from "@saleor/macaw-ui";
import { useMemo } from "react";

export const cellHeight = 40;

export function useDatagridTheme(readonly?: boolean) {
  const { themeValues } = useTheme();
  const datagridTheme = useMemo(
    (): Partial<Theme> => ({
      accentColor: themeValues.colors.background.accent1,
      accentLight: themeValues.colors.background.default2, // Neutral gray for focus highlight
      accentFg: themeValues.colors.background.default1, // Checkmark color (contrasts with accentColor)
      bgCell: themeValues.colors.background.default1,
      bgHeader: themeValues.colors.background.default1,
      bgHeaderHasFocus: "transparent",
      bgHeaderHovered: "transparent",
      bgBubbleSelected: themeValues.colors.background.default1,
      borderColor: themeValues.colors.border.default1,
      fontFamily: "'Inter var', sans-serif",
      baseFontStyle: `${themeValues.fontWeight.regular} ${themeValues.fontSize[3]}`,
      headerFontStyle: `${themeValues.fontWeight.medium} ${themeValues.fontSize[2]}`,
      editorFontSize: themeValues.fontSize[3],
      textMedium: themeValues.colors.text.default1,
      textGroupHeader: themeValues.colors.text.default1,
      textBubble: themeValues.colors.background.default1,
      textDark: themeValues.colors.text.default1,
      textLight: themeValues.colors.text.default2,
      textHeader: themeValues.colors.text.default1,
      textHeaderSelected: themeValues.colors.text.default1,
      fgIconHeader: themeValues.colors.text.default1,
      cellHorizontalPadding: 8,
      cellVerticalPadding: 8,
      lineHeight: 20,
    }),
    [themeValues],
  );
  const readonlyDatagridTheme = useMemo(
    (): Partial<Theme> => ({
      ...datagridTheme,
      accentColor: themeValues.colors.text.default2,
      accentLight: themeValues.colors.background.default2,
    }),
    [themeValues, datagridTheme],
  );

  return readonly ? readonlyDatagridTheme : datagridTheme;
}
