// Adapted from saleor-dashboard: src/orders/views/OrderList/OrderList.tsx and
// views/OrderDraftList/OrderDraftList.tsx (useOrderDraftCreateMutation's onCompleted)
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's "Create order": an empty draft, Saleor's toast, then the draft's page. Saleor first asks
// for a channel; with one channel there is nothing to ask, so the draft is created at once.
import { useMutation } from "@apollo/client";
import { defineMessages, useIntl } from "react-intl";
import { useNavigate } from "react-router";

import { OrderDraftCreateDocument } from "../graphql/types.generated";
import { useNotifier } from "../hooks/useNotifier/useNotifier";
import { orderDraftUrl } from "./urls";

const messages = defineMessages({
  created: {
    id: "AQDJ1d",
    defaultMessage: "Draft order created",
  },
});

export const useCreateDraftOrder = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const notify = useNotifier();
  const [create, { loading }] = useMutation(OrderDraftCreateDocument, {
    onCompleted: (data) => {
      const order = data.draftOrderCreate?.order;

      if (!order) {
        return;
      }

      notify({ status: "success", text: intl.formatMessage(messages.created) });
      navigate(orderDraftUrl(order.id));
    },
  });

  return { createDraftOrder: () => create({ variables: { input: {} } }), creating: loading };
};
