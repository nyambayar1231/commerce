// Adapted from saleor-dashboard: src/orders/components/OrderTransactionsSection/OrderTransactionsSection.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Transactions": one tile per transaction, or Saleor's empty-state line. Left out: the refunds
// table and "Add manual transaction" (grant refunds and manual transactions are out of scope; mark
// as paid arrives with M6.5), legacy payments, gift cards and the in-flight polling throbber.
import { Box, Text } from "@saleor/macaw-ui";
import { FormattedMessage } from "react-intl";

import type { TransactionItemFragment } from "../../../graphql/types.generated";
import { OrderTransaction } from "../OrderTransaction/OrderTransaction";

export const OrderTransactionsSection = ({
  transactions,
  onRefund,
}: {
  transactions: TransactionItemFragment[];
  onRefund?: (transactionId: string) => void;
}) => (
  <Box paddingBottom={6}>
    <Box
      as="header"
      display="flex"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      paddingX={6}
    >
      <Text size={6} fontWeight="medium">
        <FormattedMessage defaultMessage="Transactions" id="/jJLYy" />
      </Text>
    </Box>

    {transactions.map((transaction, index) => (
      <OrderTransaction
        key={transaction.id}
        transaction={transaction}
        index={index}
        onRefund={onRefund}
      />
    ))}

    {transactions.length === 0 && (
      <Box display="flex" justifyContent="center" alignItems="center">
        <Text size={2} color="default2">
          <FormattedMessage
            defaultMessage="No transactions made for this order."
            description="empty state message"
            id="7QPLu0"
          />
        </Text>
      </Box>
    )}
  </Box>
);
