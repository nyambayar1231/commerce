// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/providers/OrderFilterAPIProvider.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order filter's right-hand options. Saleor resolves a handler per row type (channels,
// customers, statuses…); our only row is the status, answered from the enum without a request.
// As Saleor's EnumValuesHandler, every status is offered whatever the typed text.
import { useIntl } from "react-intl";

import type { FilterContainer } from "../../FilterElement/FilterElement";
import type { FilterAPIProvider } from "../FilterAPIProvider";
import { emptyChoicesPage, NO_MORE_CHOICES } from "../filterChoicesPage";
import { getOrderStatusOptions } from "../initialState/orders/InitialOrderStateResponse";
import { getFilterElement } from "../utils";

export const useOrderFilterAPIProvider = (): FilterAPIProvider => {
  const intl = useIntl();

  const fetchRightOptions = async (position: string, value: FilterContainer) => {
    const filterElement = getFilterElement(value, parseInt(position, 10));

    if (filterElement.value.value !== "status") {
      return emptyChoicesPage();
    }

    return { options: getOrderStatusOptions(intl), pageInfo: NO_MORE_CHOICES };
  };

  return {
    fetchRightOptions,
  };
};
