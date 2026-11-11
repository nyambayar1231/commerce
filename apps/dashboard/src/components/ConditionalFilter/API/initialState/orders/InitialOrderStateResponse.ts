// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/initialState/orders/InitialOrderState.ts
// and useInitialOrderState.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order list's filter labels. Saleor loads channels, customers and other operands here; our
// only operand is the status, whose options are the OrderStatus enum with Saleor's localized
// labels (EnumValuesHandler + transformOrderStatus), so nothing is fetched.
import { useMemo } from "react";
import { type IntlShape, useIntl } from "react-intl";

import { transformOrderStatus } from "../../../../../misc";
import { ORDER_STATUSES } from "../../../constants";
import type { ItemOption } from "../../../FilterElement/ConditionValue";
import type { UrlToken } from "../../../ValueProvider/UrlToken";
import type { InitialAPIState, InitialStateResponse } from "../InitialStateResponse";

/** Saleor's EnumValuesHandler for OrderStatus: every status, labelled as the list's pills. */
export const getOrderStatusOptions = (intl: IntlShape): ItemOption[] =>
  ORDER_STATUSES.map((status) => ({
    label: transformOrderStatus(status, intl).localized,
    value: status,
    slug: status,
  }));

export class InitialOrderStateResponse implements InitialStateResponse {
  constructor(public status: ItemOption[] = []) {}

  public filterByUrlToken(token: UrlToken): ItemOption[] {
    if (token.name !== "status") {
      return [];
    }

    const values = Array.isArray(token.value) ? token.value : [token.value];

    return this.status.filter((option) => values.includes(option.value));
  }
}

const noQueries = async () => {};

export const useOrderInitialAPIState = (): InitialAPIState => {
  const intl = useIntl();

  return useMemo(
    () => ({
      data: new InitialOrderStateResponse(getOrderStatusOptions(intl)),
      loading: false,
      fetchQueries: noQueries,
    }),
    [intl],
  );
};
