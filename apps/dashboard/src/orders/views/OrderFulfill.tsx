// Adapted from saleor-dashboard: src/orders/views/OrderFulfill/OrderFulfill.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Loads the order's lines left to fulfil and the warehouses, runs orderFulfill, and on success
// toasts Saleor's "Fulfilled Items" and returns to the order (whose cached details the mutation
// refreshed). Errors are toasts with Saleor's order error messages; an unknown id is not found.
import { useMutation, useQuery } from "@apollo/client";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router";

import { getMutationStatus } from "../../categories/mutationStatus";
import { FulfillOrderDocument, OrderFulfillDataDocument } from "../../graphql/types.generated";
import { useNotifier } from "../../hooks/useNotifier/useNotifier";
import { NotFound } from "../../NotFound";
import { getOrderErrorMessage } from "../../utils/errors";
import { OrderFulfillPage } from "../components/OrderFulfillPage/OrderFulfillPage";
import { getFulfillSubmitLines } from "../fulfill";
import { orderUrl } from "../urls";

export const OrderFulfill = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const notify = useNotifier();
  const { data, loading } = useQuery(OrderFulfillDataDocument, { variables: { orderId: id } });
  const warehouses = useMemo(
    () => data?.warehouses?.edges.map((edge) => edge.node) ?? [],
    [data?.warehouses],
  );
  const [fulfill, fulfillOpts] = useMutation(FulfillOrderDocument, {
    onCompleted: (result) => {
      const errors = result.orderFulfill?.errors ?? [];
      if (errors.length > 0) {
        for (const error of errors) {
          notify({
            status: "error",
            text: getOrderErrorMessage(error, intl) ?? error.message ?? "",
          });
        }
        return;
      }
      notify({
        status: "success",
        text: intl.formatMessage({
          id: "CYEnGq",
          defaultMessage: "Fulfilled Items",
          description: "order fulfilled success message",
        }),
      });
      navigate(orderUrl(id));
    },
  });

  if (!loading && !data?.order) {
    return <NotFound />;
  }

  return (
    <OrderFulfillPage
      order={data?.order ?? undefined}
      warehouses={warehouses}
      saveButtonBar={getMutationStatus({
        ...fulfillOpts,
        errors: fulfillOpts.data?.orderFulfill?.errors,
      })}
      onCancel={() => navigate(orderUrl(id))}
      onSubmit={(form) =>
        void fulfill({ variables: { orderId: id, input: { lines: getFulfillSubmitLines(form) } } })
      }
    />
  );
};
