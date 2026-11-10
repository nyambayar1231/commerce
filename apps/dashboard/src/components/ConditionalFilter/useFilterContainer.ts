// Adapted from saleor-dashboard: src/components/ConditionalFilter/useFilterContainer.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Row edits for the panel. Saleor's API-backed option fetching, attribute machinery, constraints
// and debounce are dropped: our fields and values are static.

import { useConditionalFilterContext } from "./context/consumer";
import type { ConditionItem } from "./FilterElement/ConditionOptions";
import type { ConditionValue } from "./FilterElement/ConditionValue";
import { FilterElement, hasEmptyRows } from "./FilterElement/FilterElement";
import type { LeftOperand } from "./LeftOperandsProvider";

export const useFilterContainer = () => {
  const {
    containerState: { value, updateAt, getAt, removeAt, createAndRemoveEmpty },
  } = useConditionalFilterContext();

  const addEmpty = () => {
    createAndRemoveEmpty(FilterElement.createEmpty());
  };

  const updateLeftOperator = (position: string, leftOperator: LeftOperand) => {
    const current = getAt(position);

    if (FilterElement.isFilterElement(current)) {
      updateAt(position, (el) => el.updateLeftOperator(leftOperator));
    }
  };

  const updateCondition = (position: string, conditionValue: ConditionItem) => {
    updateAt(position, (el) => el.updateCondition(conditionValue));
  };

  const updateRightOperator = (position: string, rightOperator: ConditionValue) => {
    updateAt(position, (el) => el.updateRightOperator(rightOperator));
  };

  return {
    value,
    hasEmptyRows: hasEmptyRows(value),
    addEmpty,
    removeAt,
    updateLeftOperator,
    updateCondition,
    updateRightOperator,
  };
};
