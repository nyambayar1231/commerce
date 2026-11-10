// Adapted from saleor-dashboard: src/hooks/useListSettings.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Per-list settings in localStorage under Saleor's key and shape: { [listName]: { rowNumber,
// columns? } }. Saleor also deep-merges every stored list over its defaults and runs one-shot
// storage migrations; neither exists here yet. Stored column ids we no longer know are dropped.
import useLocalStorage from "./useLocalStorage";

export const listSettingsStorageKey = "listConfig";

// Saleor's PAGINATE_BY (src/config.ts).
export const PAGINATE_BY = 20;

// Saleor's PRODUCT_LIST default columns (src/config.ts) minus productType, which our product list
// cannot show yet.
export const PRODUCT_LIST_DEFAULT_COLUMNS = [
  "name",
  "availability",
  "price",
  "productCategory",
  "date",
  "created",
];

export type ListViews = "CATEGORY_LIST" | "COLLECTION_PRODUCTS_LIST" | "PRODUCT_LIST";

export interface ListSettings {
  columns?: string[];
  rowNumber: number;
}

export type ListSettingsUpdate = <T extends keyof ListSettings>(
  key: T,
  value: ListSettings[T],
) => void;

type AppListViewSettings = Record<ListViews, ListSettings>;

const defaultListSettings: AppListViewSettings = {
  CATEGORY_LIST: { rowNumber: PAGINATE_BY },
  // Saleor's CategoryProducts uses ListViews.COLLECTION_PRODUCTS_LIST for the card's row count.
  COLLECTION_PRODUCTS_LIST: { rowNumber: PAGINATE_BY },
  PRODUCT_LIST: {
    rowNumber: PAGINATE_BY,
    columns: PRODUCT_LIST_DEFAULT_COLUMNS,
  },
};

const isRowNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

// Keep the user's order, drop ids this list no longer knows (a removed or renamed column), and
// fall back to the defaults when nothing familiar is left.
const parseColumns = (value: string[], defaults: string[]): string[] => {
  const known = new Set(defaults);
  const columns: string[] = [];

  for (const id of value) {
    if (known.has(id) && !columns.includes(id)) {
      columns.push(id);
    }
  }

  return columns.length > 0 ? columns : defaults;
};

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
        const storedSettings = (stored as Partial<AppListViewSettings>)[name];
        const rowNumber = storedSettings?.rowNumber;
        const storedColumns = storedSettings?.columns;
        const defaults = defaultListSettings[name];

        merged[name] = {
          ...defaults,
          ...(isRowNumber(rowNumber) ? { rowNumber } : {}),
          ...(defaults.columns && isStringArray(storedColumns)
            ? { columns: parseColumns(storedColumns, defaults.columns) }
            : {}),
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
