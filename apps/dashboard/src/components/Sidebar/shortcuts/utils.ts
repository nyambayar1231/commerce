// Adapted from saleor-dashboard: src/components/Sidebar/shortcuts/utils.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
export const getShortcutLeadingKey = () => {
  return navigator.appVersion.toLowerCase().includes("mac") ? "⌘" : "Ctrl";
};
