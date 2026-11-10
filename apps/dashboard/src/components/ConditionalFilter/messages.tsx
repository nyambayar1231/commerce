// Adapted from saleor-dashboard: src/components/ConditionalFilter/messages.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel's copy. Popover/inline-only strings ("Save", "Filter", "Popover title") are dropped
// with those layouts.
import { defineMessages, useIntl } from "react-intl";

export const conditionalFilterMessages = defineMessages({
  popoverTrigger: {
    defaultMessage: "Filters",
    id: "FNpv6K",
    description: "button",
  },
  addCondition: {
    defaultMessage: "Add condition",
    id: "xzqW+K",
    description: "Add condition button on the list filter panel",
  },
  clearFilters: {
    defaultMessage: "Clear filters",
    id: "SHF+gG",
    description: "Clear filters button text",
  },
  closePanel: {
    defaultMessage: "Close",
    id: "9exKzi",
    description: "Close the list filter panel without clearing applied filters",
  },
  applyPanelFilters: {
    defaultMessage: "Apply",
    id: "FK088X",
    description: "Apply filters from the list filter panel",
  },
  emptyFilters: {
    id: "4IVdnm",
    defaultMessage: "No filters",
    description: "Empty state when the filter panel has no conditions",
  },
  filterWhereElement: {
    defaultMessage: "Where",
    id: "5o84YO",
    description: "Filter where element text",
  },
  filterAndElement: {
    defaultMessage: "And",
    id: "5ZYUn5",
    description: "Filter and element text",
  },
});

export const useFiltersAreaTranslations = () => {
  const { formatMessage } = useIntl();

  return {
    addCondition: formatMessage(conditionalFilterMessages.addCondition),
    clearFilters: formatMessage(conditionalFilterMessages.clearFilters),
    closePanel: formatMessage(conditionalFilterMessages.closePanel),
    applyPanelFilters: formatMessage(conditionalFilterMessages.applyPanelFilters),
    locale: {
      WHERE: formatMessage(conditionalFilterMessages.filterWhereElement),
      AND: formatMessage(conditionalFilterMessages.filterAndElement),
      noValueText: formatMessage(conditionalFilterMessages.emptyFilters),
    },
  };
};
