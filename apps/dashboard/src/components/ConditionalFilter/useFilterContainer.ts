// Adapted from saleor-dashboard: src/components/ConditionalFilter/useFilterContainer.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Row edits for the panel plus the category picker's API paging: first page on focus, a debounced
// search as you type, the next page on scroll end. Saleor's attribute machinery, constraints and
// error tracker are dropped.
import { useRef } from "react";

import useDebounce from "../../hooks/useDebounce";
import type { FilterAPIProvider } from "./API/FilterAPIProvider";
import {
  appendUniqueOptions,
  createChoiceFetchState,
  hasSameChoiceQuery,
  isCurrentChoiceGeneration,
  startAppendChoiceFetch,
  startReplaceChoiceFetch,
} from "./API/filterChoicesPage";
import { useConditionalFilterContext } from "./context/consumer";
import type { ConditionItem } from "./FilterElement/ConditionOptions";
import {
  type ConditionValue,
  isItemOption,
  isItemOptionArray,
} from "./FilterElement/ConditionValue";
import { FilterElement, hasEmptyRows } from "./FilterElement/FilterElement";
import type { LeftOperand } from "./LeftOperandsProvider";

export const useFilterContainer = (apiProvider?: FilterAPIProvider) => {
  const {
    containerState: { value, updateAt, getAt, removeAt, createAndRemoveEmpty },
  } = useConditionalFilterContext();
  const choiceSession = useRef(createChoiceFetchState());

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

    if (
      (isItemOption(rightOperator) || isItemOptionArray(rightOperator)) &&
      !hasSameChoiceQuery(choiceSession.current, `right:${position}`, "")
    ) {
      fetchRightOptionsList(position, "");
    }
  };

  const updateRightLoadingState = (position: string, loading: boolean) => {
    updateAt(position, (el) => el.updateRightLoadingState(loading));
  };

  const fetchRightOptions = async (position: string, inputValue: string, after?: string | null) => {
    if (!apiProvider) return;

    const fetchKey = `right:${position}`;
    const session = choiceSession.current;
    const isAppend = Boolean(after);
    const generation = isAppend
      ? startAppendChoiceFetch(session, fetchKey)
      : startReplaceChoiceFetch(session, fetchKey, inputValue);

    if (generation === null) {
      return;
    }

    updateRightLoadingState(position, true);

    try {
      const result = await apiProvider.fetchRightOptions(position, value, inputValue, after);

      if (!isCurrentChoiceGeneration(session, fetchKey, generation)) {
        return;
      }

      session.pageInfo[fetchKey] = result.pageInfo;
      updateAt(position, (el) => {
        const currentOptions = el.condition.selected.options.filter(isItemOption);
        const options = isAppend
          ? appendUniqueOptions(currentOptions, result.options)
          : result.options;

        el.updateRightOptions(options);
        el.updateRightLoadingState(false);
      });
    } catch (error) {
      if (!isCurrentChoiceGeneration(session, fetchKey, generation)) {
        return;
      }

      console.error("Failed to fetch filter options", error);
      updateRightLoadingState(position, false);
    } finally {
      if (isAppend && isCurrentChoiceGeneration(session, fetchKey, generation)) {
        session.fetchMoreInFlight[fetchKey] = false;
      }
    }
  };

  const fetchRightOptionsList = (position: string, inputValue: string) => {
    void fetchRightOptions(position, inputValue);
  };

  const fetchMoreRightOptions = (position: string) => {
    const fetchKey = `right:${position}`;
    const page = choiceSession.current.pageInfo[fetchKey];

    if (!page?.endCursor) {
      return;
    }

    void fetchRightOptions(position, choiceSession.current.query[fetchKey] ?? "", page.endCursor);
  };

  const debouncedFetchRightOptions = useDebounce((position: string, inputValue: string) => {
    if (!hasSameChoiceQuery(choiceSession.current, `right:${position}`, inputValue)) {
      return;
    }

    void fetchRightOptions(position, inputValue);
  }, 500);

  const updateRightOptions = (position: string, inputValue: string) => {
    const fetchKey = `right:${position}`;

    if (hasSameChoiceQuery(choiceSession.current, fetchKey, inputValue)) {
      return;
    }

    if (inputValue === "") {
      fetchRightOptionsList(position, "");

      return;
    }

    startReplaceChoiceFetch(choiceSession.current, fetchKey, inputValue);
    updateRightLoadingState(position, true);
    debouncedFetchRightOptions(position, inputValue);
  };

  return {
    value,
    hasEmptyRows: hasEmptyRows(value),
    addEmpty,
    removeAt,
    updateLeftOperator,
    updateRightOperator,
    updateCondition,
    updateRightOptions,
    fetchRightOptionsList,
    fetchMoreRightOptions,
  };
};
