// Adapted from saleor-dashboard: src/components/ConditionalFilter/FiltersArea.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel body below the toolbar: the rows, "+ Add condition" and the footer buttons. Apply is
// disabled while a row is empty or nothing changed. The category picker's focus/typing/scroll
// events fetch its options. Saleor's constraints, attributes and popover/inline labels are
// dropped.
import { Box } from "@saleor/macaw-ui";
import { type FC, useMemo, useState } from "react";

import { useConditionalFilterContext } from "./context/consumer";
import type { FilterContainer } from "./FilterElement/FilterElement";
import { useFiltersAreaTranslations } from "./messages";
import { type ConditionalFiltersLayout, type FilterEvent, Filters, type Row } from "./UI";
import { useFilterContainer } from "./useFilterContainer";
import { useFilteredOperands } from "./useFilteredOperands";
import type { ErrorEntry } from "./Validation";
import { getFilterContainerKey, hasUnsavedFilterChanges } from "./ValueProvider/utils";

interface FiltersAreaProps {
  onConfirm: (value: FilterContainer) => boolean | undefined;
  errors?: ErrorEntry[];
  onClear?: () => void;
  onCancel?: () => void;
  layout?: ConditionalFiltersLayout;
}

const MAX_VALUE_ITEMS = 12;

export const FiltersArea: FC<FiltersAreaProps> = ({
  onConfirm,
  onClear,
  onCancel,
  errors,
  layout = "panel",
}) => {
  const { apiProvider, leftOperandsProvider, valueProvider } = useConditionalFilterContext();
  const translations = useFiltersAreaTranslations();
  const {
    value,
    hasEmptyRows,
    addEmpty,
    removeAt,
    updateLeftOperator,
    updateRightOperator,
    updateCondition,
    updateRightOptions,
    fetchRightOptionsList,
    fetchMoreRightOptions,
  } = useFilterContainer(apiProvider);
  const filteredOperands = useFilteredOperands(leftOperandsProvider.operands, value);
  const [committedKey, setCommittedKey] = useState(() =>
    getFilterContainerKey(valueProvider.value),
  );
  const hasUnsavedChanges = useMemo(
    () => hasUnsavedFilterChanges(value, committedKey),
    [value, committedKey],
  );
  const isConfirmDisabled = hasEmptyRows || !hasUnsavedChanges;
  const commitCurrentValue = (next: FilterContainer): void => {
    setCommittedKey(getFilterContainerKey(next));
  };

  const handleStateChange = (event: FilterEvent["detail"]) => {
    if (!event) return;

    if (event.type === "row.add") {
      addEmpty();
    }

    if (event.type === "row.remove") {
      removeAt(event.path);
    }

    if (event.type === "leftOperator.onChange") {
      updateLeftOperator(event.path, event.value);
    }

    if (event.type === "condition.onChange") {
      updateCondition(event.path.split(".")[0] as string, event.value);
    }

    if (event.type === "rightOperator.onChange") {
      updateRightOperator(event.path.split(".")[0] as string, event.value);
    }

    if (event.type === "rightOperator.onFocus") {
      fetchRightOptionsList(event.path.split(".")[0] as string, "");
    }

    if (event.type === "rightOperator.onInputValueChange") {
      updateRightOptions(event.path.split(".")[0] as string, event.value);
    }

    if (event.type === "rightOperator.onScrollEnd") {
      fetchMoreRightOptions(event.path.split(".")[0] as string);
    }
  };

  return (
    <Filters
      layout={layout}
      leftOptions={filteredOperands}
      value={value as Array<string | Row>}
      onChange={handleStateChange}
      error={errors}
      locale={translations.locale}
    >
      <Filters.Footer>
        <Filters.AddRowButton
          disabled={value.length > MAX_VALUE_ITEMS}
          data-test-id="add-filter-button"
          variant="tertiary"
        >
          {translations.addCondition}
        </Filters.AddRowButton>
        <Box display="flex" gap={3}>
          <Filters.ClearButton
            onClick={() => {
              onClear?.();
              commitCurrentValue([]);
            }}
            variant="tertiary"
            data-test-id="reset-all-filters-button"
          >
            {translations.clearFilters}
          </Filters.ClearButton>
          <Filters.CloseButton onClick={onCancel} data-test-id="close-filters-button">
            {translations.closePanel}
          </Filters.CloseButton>
          <Filters.ConfirmButton
            onClick={() => {
              if (onConfirm(value) !== false) {
                commitCurrentValue(value);
              }
            }}
            disabled={isConfirmDisabled}
            data-test-id="save-filters-button"
          >
            {translations.applyPanelFilters}
          </Filters.ConfirmButton>
        </Box>
      </Filters.Footer>
    </Filters>
  );
};
