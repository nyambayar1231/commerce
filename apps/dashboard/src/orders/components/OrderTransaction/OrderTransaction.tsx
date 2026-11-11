// Adapted from saleor-dashboard: src/orders/components/OrderTransaction/OrderTransaction.tsx and
// components/CardTitle/CardTitle.tsx, MoneyDisplay.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// A transaction tile, open by default: "Transaction #n on <date>", the provider name, its non-zero
// amounts, and the events table when expanded. Left out: the transaction actions (refund arrives
// with M6.5), payment-method details, the external link and fake (optimistic) transactions.
import { Accordion, Box, Text } from "@saleor/macaw-ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { iconSize, iconStrokeWidthBySize } from "../../../components/icons";
import type { TransactionItemFragment } from "../../../graphql/types.generated";
import styles from "./OrderTransaction.module.css";
import { EventTime, TransactionEvents } from "./TransactionEvents";
import { getTransactionAmounts } from "./utils";

const MoneyDisplay = ({
  label,
  money,
}: {
  label: string;
  money: { amount: number; currency: string };
}) => {
  const intl = useIntl();

  return (
    <Box display="flex" flexDirection="column" alignItems="flex-end">
      <Text size={2} color="default2">
        {label}
      </Text>
      <Box as="span">
        <Text size={3}>{money.currency}&nbsp;</Text>
        <Text size={3} fontWeight="bold">
          {intl.formatNumber(money.amount, { maximumFractionDigits: 0 })}
        </Text>
      </Box>
    </Box>
  );
};

interface OrderTransactionProps {
  transaction: TransactionItemFragment;
  index: number;
}

export const OrderTransaction = ({ transaction, index }: OrderTransactionProps) => {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(transaction.id);

  return (
    <Box data-test-id="orderTransactionsList" marginTop={4} marginX={6}>
      <Accordion type="single" value={expanded} onValueChange={setExpanded}>
        <Accordion.Item value={transaction.id}>
          <Box
            backgroundColor="default2"
            borderRadius={4}
            borderStyle="solid"
            borderColor="default1"
            borderWidth={1}
            overflow="hidden"
          >
            <Accordion.Trigger>
              <Box paddingY={4} paddingX={5} width="100%">
                <Box
                  width="100%"
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={4}
                >
                  <Box display="flex" flexDirection="column" gap={0.5}>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Box className={styles.chevron}>
                        <ChevronDown
                          size={iconSize.small}
                          strokeWidth={iconStrokeWidthBySize.small}
                        />
                      </Box>
                      <Text size={4} fontWeight="medium">
                        <FormattedMessage
                          defaultMessage="Transaction #{index} on {date}"
                          id="nYD7NT"
                          values={{
                            index: index + 1,
                            date: <EventTime date={transaction.createdAt} />,
                          }}
                        />
                      </Text>
                    </Box>
                    {transaction.name && (
                      <Text size={2} color="default2" fontWeight="medium">
                        {transaction.name}
                      </Text>
                    )}
                  </Box>
                  <Box display="flex" gap={4} alignItems="center">
                    {getTransactionAmounts(transaction).map(({ label, money }) => (
                      <MoneyDisplay
                        key={label.id}
                        label={intl.formatMessage(label)}
                        money={money}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>
            </Accordion.Trigger>
            <Accordion.Content>
              <Box
                borderTopStyle="solid"
                borderColor="default1"
                borderTopWidth={1}
                backgroundColor="default1"
              >
                <TransactionEvents events={transaction.events} />
              </Box>
            </Accordion.Content>
          </Box>
        </Accordion.Item>
      </Accordion>
    </Box>
  );
};
