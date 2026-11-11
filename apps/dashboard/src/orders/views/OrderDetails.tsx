// Adapted from saleor-dashboard: src/orders/views/OrderDetails/OrderDetails.tsx (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Loads the order named by the URL and shows the read-only page; an unknown id is not found. The
// actions (fulfil, cancel, mark as paid, refund) arrive with M6.5.
import { useQuery } from "@apollo/client";
import { useParams } from "react-router";

import { OrderDetailsDocument } from "../../graphql/types.generated";
import { NotFound } from "../../NotFound";
import { OrderDetailsPage } from "../components/OrderDetailsPage/OrderDetailsPage";

export const OrderDetails = () => {
  const { id = "" } = useParams();
  const { data, loading } = useQuery(OrderDetailsDocument, { variables: { id } });
  const order = data?.order ?? undefined;

  if (!loading && !order) {
    return <NotFound />;
  }

  return <OrderDetailsPage order={order} />;
};
