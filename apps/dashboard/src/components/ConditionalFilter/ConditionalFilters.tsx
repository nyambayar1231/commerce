// Adapted from saleor-dashboard: src/components/ConditionalFilter/ConditionalFilters.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Apply validates, persists to the URL and closes; Clear persists an empty filter set; Close
// discards unsaved edits. A skeleton covers the first lookup of the URL's filter values. Saleor's
// analytics and query API type are dropped.
import { Box } from "@saleor/macaw-ui";
import { type FC, useEffect, useRef, useState } from "react";

import { useConditionalFilterContext } from "./context/consumer";
import type { FilterContainer } from "./FilterElement/FilterElement";
import { FiltersArea } from "./FiltersArea";
import { LoadingFiltersArea } from "./LoadingFiltersArea";
import type { ConditionalFiltersLayout } from "./UI";
import { type ErrorEntry, Validator } from "./Validation";

interface ConditionalFiltersProps {
  onClose: () => void;
  layout?: ConditionalFiltersLayout;
}

export const ConditionalFilters: FC<ConditionalFiltersProps> = ({ onClose, layout = "panel" }) => {
  const { valueProvider, containerState } = useConditionalFilterContext();
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (!valueProvider.loading) {
      hasLoadedOnceRef.current = true;
    }
  }, [valueProvider.loading]);

  // As Saleor: only the first load shows the skeleton, so applying a filter does not flash it.
  const showLoading = valueProvider.loading && !hasLoadedOnceRef.current;

  const handleConfirm = (value: FilterContainer): boolean => {
    const validator = new Validator(value);

    if (!validator.isValid()) {
      setErrors(validator.getErrors());

      return false;
    }

    valueProvider.persist(value);
    onClose();

    return true;
  };
  const handleClear = () => {
    valueProvider.clear();
    containerState.resetToProvider();
    onClose();
  };
  const handleCancel = () => {
    containerState.resetToProvider();
    onClose();
  };

  if (showLoading) {
    return <LoadingFiltersArea layout={layout} />;
  }

  return (
    <Box padding={3} width="100%" __minWidth="0">
      <FiltersArea
        layout={layout}
        onConfirm={handleConfirm}
        errors={errors}
        onClear={handleClear}
        onCancel={handleCancel}
      />
    </Box>
  );
};
