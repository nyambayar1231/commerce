// Adapted from saleor-dashboard: src/components/ConditionalFilter/useContainerState.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The panel edits a local copy of the applied rows; Apply persists it to the URL. Saleor's
// constraint bookkeeping and its loading branch are dropped: our URL provider is synchronous and
// has no constraints.
import { useEffect, useRef, useState } from "react";

import {
  cloneFilterContainer,
  type FilterContainer,
  FilterElement,
} from "./FilterElement/FilterElement";
import type { FilterValueProvider } from "./FilterValueProvider";
import { getFilterContainerKey } from "./ValueProvider/utils";

type StateCallback = (el: FilterElement) => void;
type Element = FilterContainer[number];

const getProviderSyncKey = (valueProvider: FilterValueProvider): string =>
  getFilterContainerKey(valueProvider.value);

/** The row and the `AND` glued to it: the next separator, or else the one before. */
const calculateIndexesToRemove = (container: FilterContainer, position: number): number[] => {
  const next = position + 1;
  const previous = position - 1;
  const indexTuple = [position];

  if (typeof container[next] === "string") {
    indexTuple.push(next);

    return indexTuple;
  }

  if (typeof container[previous] === "string") {
    indexTuple.push(previous);
  }

  return indexTuple;
};

const removeElement = (container: FilterContainer, position: number): FilterContainer => {
  const indexTuple = calculateIndexesToRemove(container, position);

  return container.filter((_, elIndex) => !indexTuple.includes(elIndex));
};

const removeEmptyElements = (container: FilterContainer): FilterContainer => {
  const emptyIndex = container.findIndex((el) => FilterElement.isFilterElement(el) && el.isEmpty());

  if (emptyIndex < 0) return container;

  return removeEmptyElements(removeElement(container, emptyIndex));
};

export const useContainerState = (valueProvider: FilterValueProvider) => {
  const [value, setValue] = useState<FilterContainer>(() =>
    cloneFilterContainer(valueProvider.value),
  );
  const providerSyncKeyRef = useRef(getProviderSyncKey(valueProvider));

  useEffect(() => {
    const nextProviderSyncKey = getProviderSyncKey(valueProvider);

    if (nextProviderSyncKey === providerSyncKeyRef.current) {
      return;
    }

    providerSyncKeyRef.current = nextProviderSyncKey;
    setValue(cloneFilterContainer(valueProvider.value));
  }, [valueProvider]);

  const updateFilterElement =
    (index: number, cb: StateCallback) =>
    (el: Element, elIndex: number): Element => {
      if (elIndex === index && FilterElement.isFilterElement(el)) {
        cb(el);
      }

      return el;
    };

  const updateAt = (position: string, cb: StateCallback): void => {
    const index = Number.parseInt(position, 10);

    setValue((v) => v.map(updateFilterElement(index, cb)));
  };

  const getAt = (position: string): Element | undefined => {
    const index = Number.parseInt(position, 10);

    return value[index];
  };

  const removeAt = (position: string): void => {
    const index = Number.parseInt(position, 10);

    setValue((v) => removeElement(v, index));
  };

  const createNewValue = (value: FilterContainer, element: FilterElement): FilterContainer => {
    const newValue: FilterContainer = [];

    if (value.length > 0) {
      newValue.push("AND");
    }

    newValue.push(element);

    return newValue;
  };

  const create = (element: FilterElement): void => {
    const newValue = createNewValue(value, element);

    setValue((v) => v.concat(newValue));
  };

  /* A click outside the filter panel can create a row before the previous empty row has been
   * removed; clear empty rows first so the new row lands on a clean list. */
  const createAndRemoveEmpty = (element: FilterElement): void => {
    const filteredValue = removeEmptyElements(value);
    const newValue = createNewValue(filteredValue, element);

    setValue(() => filteredValue.concat(newValue));
  };

  const createEmpty = (): void => {
    create(FilterElement.createEmpty());
  };

  const clear = (): void => {
    setValue([]);
  };

  const resetToProvider = (options?: { seedEmpty?: boolean }): void => {
    const next = cloneFilterContainer(valueProvider.value);

    setValue(options?.seedEmpty && next.length === 0 ? [FilterElement.createEmpty()] : next);
    providerSyncKeyRef.current = getProviderSyncKey(valueProvider);
  };

  const clearEmpty = (): void => {
    setValue((v) => removeEmptyElements(v));
  };

  return {
    create,
    createAndRemoveEmpty,
    createEmpty,
    getAt,
    updateAt,
    removeAt,
    value,
    clear,
    resetToProvider,
    clearEmpty,
  };
};
