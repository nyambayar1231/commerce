// Adapted from saleor-dashboard: src/components/AppLayout/ListFilters/components/ExpressionFilters.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The toolbar's "Filters" button (with an active-filter count) and the panel it folds out below.
// Opening seeds one empty row when no filters are applied; folding discards unsaved edits.
import { Box, Button, Text } from "@saleor/macaw-ui";
import { ChevronDown, ListFilter } from "lucide-react";
import { useIntl } from "react-intl";

import { ConditionalFilters } from "../../../ConditionalFilter/ConditionalFilters";
import { useConditionalFilterContext } from "../../../ConditionalFilter/context/consumer";
import { conditionalFilterMessages } from "../../../ConditionalFilter/messages";
import { CountPill, countPillFromNumber } from "../../../CountPill/CountPill";
import { iconSize, iconStrokeWidth } from "../../../icons";
import styles from "./ExpressionFilters.module.css";

const EXPRESSION_FILTERS_PANEL_ID = "expression-filters-panel";

export const ExpressionFilters = (): React.ReactNode => {
  const { formatMessage } = useIntl();
  const { valueProvider, containerState, filterWindow } = useConditionalFilterContext();
  const handleToggle = (): void => {
    if (filterWindow.isOpen) {
      containerState.resetToProvider();
      filterWindow.setOpen(false);

      return;
    }

    containerState.resetToProvider({ seedEmpty: true });
    filterWindow.setOpen(true);
  };

  return (
    <Button
      data-test-id="filters-button"
      data-state={filterWindow.isOpen ? "open" : "closed"}
      aria-expanded={filterWindow.isOpen}
      aria-controls={EXPRESSION_FILTERS_PANEL_ID}
      variant="secondary"
      gap={1.5}
      icon={<ListFilter size={iconSize.small} strokeWidth={iconStrokeWidth} />}
      onClick={handleToggle}
    >
      <Box as="span" display="inline-flex" alignItems="center" gap={1}>
        <Text as="span" size={3} fontWeight="regular">
          {formatMessage(conditionalFilterMessages.popoverTrigger)}
        </Text>
        <CountPill count={countPillFromNumber(valueProvider.count)} active />
      </Box>
      <ChevronDown
        className={[styles.chevron, filterWindow.isOpen && styles.chevronOpen]
          .filter(Boolean)
          .join(" ")}
        size={iconSize.small}
        strokeWidth={iconStrokeWidth}
        aria-hidden
      />
    </Button>
  );
};

export const ExpressionFilterPanel = (): JSX.Element | null => {
  const { containerState, filterWindow } = useConditionalFilterContext();

  if (!filterWindow.isOpen) {
    return null;
  }

  const collapse = (): void => {
    containerState.resetToProvider();
    filterWindow.setOpen(false);
  };

  return (
    <div className={styles.panel} id={EXPRESSION_FILTERS_PANEL_ID} data-test-id="filters-panel">
      <ConditionalFilters layout="panel" onClose={collapse} />
    </div>
  );
};
