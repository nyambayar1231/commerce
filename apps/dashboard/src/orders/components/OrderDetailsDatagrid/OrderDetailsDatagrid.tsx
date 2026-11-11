// Adapted from saleor-dashboard: src/orders/components/OrderDetailsDatagrid/OrderDetailsDatagrid.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order lines as a read-only grid. Saleor's column picker, row menu (line metadata, price
// breakdown), loading skeletons and row focus are left out: our lines have no metadata or
// discounts, and the page shows its own loading state.
import { useMemo } from "react";
import { useIntl } from "react-intl";

import { Datagrid } from "../../../components/Datagrid/Datagrid";
import type { OrderLineFragment } from "../../../graphql/types.generated";
import { createGetCellContent, orderDetailsStaticColumnsAdapter } from "./datagrid";

interface OrderDetailsDatagridProps {
  lines: OrderLineFragment[];
}

export const OrderDetailsDatagrid = ({ lines }: OrderDetailsDatagridProps) => {
  const intl = useIntl();
  const columns = useMemo(() => orderDetailsStaticColumnsAdapter(intl), [intl]);
  const getCellContent = useMemo(() => createGetCellContent(columns, lines), [columns, lines]);

  return (
    <Datagrid
      readonly
      rowMarkers="none"
      freezeColumns={0}
      verticalBorder={false}
      showTopBorder={false}
      availableColumns={columns}
      rows={lines.length}
      getCellContent={getCellContent}
      emptyText=""
    />
  );
};
