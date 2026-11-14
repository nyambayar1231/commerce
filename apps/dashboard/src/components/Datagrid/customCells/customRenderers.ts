// The custom cell renderers our grids use (Saleor: useCustomCellRenderers, which also has dropdown
// and other cells that come with their lists). The date, money and number cells format with the
// UI locale, so the list is built per locale.
import type { CustomRenderer } from "@glideapps/glide-data-grid";
import { useMemo } from "react";
import { useIntl } from "react-intl";

import { chevronCellRenderer } from "./ChevronCell";
import { dateCellRenderer } from "./DateCell";
import { moneyCellRenderer } from "./MoneyCell";
import { numberCellRenderer } from "./NumberCell";
import { pillCellRenderer } from "./PillCell";
import { throbberCellRenderer } from "./ThrobberCell";
import { thumbnailCellRenderer } from "./ThumbnailCell";

export const useCustomCellRenderers = (): readonly CustomRenderer[] => {
  const { locale } = useIntl();

  return useMemo(
    () =>
      [
        chevronCellRenderer,
        throbberCellRenderer,
        thumbnailCellRenderer,
        pillCellRenderer,
        dateCellRenderer(locale),
        moneyCellRenderer(locale),
        numberCellRenderer(locale),
      ] as unknown as readonly CustomRenderer[],
    [locale],
  );
};
