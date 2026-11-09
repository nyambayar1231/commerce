// Adapted from saleor-dashboard: src/hooks/useListSettings.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Per-list settings in localStorage under Saleor's key and shape: { [listName]: { rowNumber } }.
// Saleor also stores visible columns (column picker) and runs storage migrations; neither exists
// here yet.
import useLocalStorage from "./useLocalStorage";

export const listSettingsStorageKey = "listConfig";

// Saleor's PAGINATE_BY (src/config.ts).
export const PAGINATE_BY = 20;

export type ListViews = "CATEGORY_LIST";

export interface ListSettings {
  rowNumber: number;
}

export type ListSettingsUpdate = <T extends keyof ListSettings>(
  key: T,
  value: ListSettings[T],
) => void;

type AppListViewSettings = Record<ListViews, ListSettings>;

const defaultListSettings: AppListViewSettings = {
  CATEGORY_LIST: { rowNumber: PAGINATE_BY },
};

const isRowNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100;

export default function useListSettings(listName: ListViews) {
  const [settings, setListSettings] = useLocalStorage<AppListViewSettings>(
    listSettingsStorageKey,
    (stored) => {
      // `typeof null === "object"` — treat null/non-objects as a fresh install.
      if (!stored || typeof stored !== "object") {
        return defaultListSettings;
      }

      const merged = { ...defaultListSettings };

      for (const name of Object.keys(defaultListSettings) as ListViews[]) {
        const rowNumber = (stored as Partial<AppListViewSettings>)[name]?.rowNumber;

        merged[name] = {
          ...defaultListSettings[name],
          ...(isRowNumber(rowNumber) ? { rowNumber } : {}),
        };
      }

      return merged;
    },
  );

  const updateListSettings: ListSettingsUpdate = (key, value) =>
    setListSettings((current) => ({
      ...current,
      [listName]: {
        ...current[listName],
        [key]: value,
      },
    }));

  return { settings: settings[listName], updateListSettings };
}
