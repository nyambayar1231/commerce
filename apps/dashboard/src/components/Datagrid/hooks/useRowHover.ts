// Adapted from saleor-dashboard: src/components/Datagrid/hooks/useRowHover.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
import type { GridMouseEventArgs } from "@glideapps/glide-data-grid";
import { useCallback, useState } from "react";

export const useRowHover = ({
  hasRowHover,
  onRowHover,
}: {
  hasRowHover?: boolean;
  onRowHover?: (args: GridMouseEventArgs) => void;
}) => {
  const [hoverRow, setHoverRow] = useState<number | undefined>(undefined);

  const handleRowHover = useCallback(
    (args: GridMouseEventArgs) => {
      if (hasRowHover) {
        const [_, row] = args.location;

        setHoverRow(args.kind !== "cell" ? undefined : row);
      }

      onRowHover?.(args);
    },
    [hasRowHover, onRowHover],
  );

  return {
    hoverRow,
    handleRowHover,
  };
};
