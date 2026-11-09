// Adapted from saleor-dashboard: src/components/Form/useExitFormDialogProvider.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Opening or closing a URL-driven dialog (`?action=…`) on the same page is not "leaving".

const DIALOG_QUERY_PARAMS = ["action", "id", "ids", "channelId", "type"];

const isFilterQueryKey = (key: string): boolean => /^\d+$/.test(key);

export const isTransientQueryKey = (key: string): boolean =>
  DIALOG_QUERY_PARAMS.includes(key) || isFilterQueryKey(key);

const splitDialogParams = (search: string) => {
  const dialog: string[] = [];
  const rest: string[] = [];

  for (const [key, value] of new URLSearchParams(search)) {
    (isTransientQueryKey(key) ? dialog : rest).push(`${key}=${value}`);
  }

  return { dialog: dialog.sort().join("&"), rest: rest.sort().join("&") };
};

export const isDialogOnlyQueryChange = (currentSearch: string, nextSearch: string): boolean => {
  const current = splitDialogParams(currentSearch);
  const next = splitDialogParams(nextSearch);

  return current.rest === next.rest && current.dialog !== next.dialog;
};
