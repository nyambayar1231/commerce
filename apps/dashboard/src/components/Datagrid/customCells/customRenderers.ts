// The custom cell renderers our grids use (Saleor: useCustomCellRenderers, which also has number,
// dropdown and other cells that come with their lists). The date and money cells format with the
// UI locale, so the list is built per locale.
import type { CustomRenderer } from "@glideapps/glide-data-grid";
import { useMemo } from "react";
import { useIntl } from "react-intl";

import { chevronCellRenderer } from "./ChevronCell";
import { dateCellRenderer } from "./DateCell";
import { moneyCellRenderer } from "./MoneyCell";
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
      ] as unknown as readonly CustomRenderer[],
    [locale],
  );
};
