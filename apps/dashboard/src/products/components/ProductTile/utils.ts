// Adapted from saleor-dashboard: src/products/components/ProductTile/utils.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's getTileStatus reads a channel listing per channel; our products are single-channel, so
// the list's availability rule decides the dot (the same rule as the datagrid's status label).
import type { DotStatus } from "../../../components/StatusDot/StatusDot";
import type { ProductListRowFragment } from "../../../graphql/types.generated";
import { getProductAvailability } from "../ProductListDatagrid/datagrid";

export const getTileStatus = (
  product: Pick<ProductListRowFragment, "isPublished" | "publishedAt">,
  dateNow: number,
): DotStatus => (getProductAvailability(product, dateNow) === "published" ? "success" : "error");
