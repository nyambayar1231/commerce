// Adapted from saleor-dashboard: src/orders/components/OrderTransaction/components/TransactionEvents/
// TransactionEvents.tsx and components/EventItem.tsx, EventStatus.tsx, EventType.tsx, EventTime.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The events table inside a transaction tile: status pill, type, PSP reference, amount and time.
// Left out: the actor avatar (no apps or staff on our events), the message tooltip, PSP-reference
// copy/hover linking and Saleor's "pending" fake events.
import { Text } from "@saleor/macaw-ui";
import { FormattedMessage, useIntl } from "react-intl";

import { Pill } from "../../../components/Pill/Pill";
import type { TransactionEventFragment } from "../../../graphql/types.generated";
import { messages, statusMessages, transactionEventTypeMessages } from "./messages";
import { mapTransactionEvent, shouldShowAmount, type TransactionEventStatus } from "./utils";

const EventStatus = ({ status }: { status: TransactionEventStatus }) => {
  const intl = useIntl();

  switch (status) {
    case "SUCCESS":
      return (
        <Pill color="success" size="small" label={intl.formatMessage(statusMessages.success)} />
      );
    case "FAILED":
      return <Pill color="error" size="small" label={intl.formatMessage(statusMessages.failure)} />;
    case "REQUEST":
      return <Pill color="info" size="small" label={intl.formatMessage(statusMessages.request)} />;
    default:
      return <Pill color="neutral" size="small" label={intl.formatMessage(statusMessages.info)} />;
  }
};

const capitalize = (value: string): string =>
  value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;

/** Saleor's EventTime: date and time with the time zone. */
export const EventTime = ({ date }: { date: unknown }) => {
  const { locale } = useIntl();
  const parsed = typeof date === "string" ? new Date(date) : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return (
      <Text size={2} color="default2">
        —
      </Text>
    );
  }

  return (
    <Text size={2} whiteSpace="nowrap">
      <time dateTime={date as string}>
        {new Intl.DateTimeFormat(locale, {
          timeZoneName: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(parsed)}
      </time>
    </Text>
  );
};

const cellStyle = { padding: "var(--mu-spacing-3)" };

export const TransactionEvents = ({ events }: { events: TransactionEventFragment[] }) => {
  const intl = useIntl();

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {events.length === 0 ? (
          <tr>
            <td style={{ ...cellStyle, paddingLeft: 48 }}>
              <Text size={2} color="default2">
                <FormattedMessage {...messages.noEvents} />
              </Text>
            </td>
          </tr>
        ) : (
          events.map((event) => {
            const { type, status } = mapTransactionEvent(event.type);
            const typeMessage =
              type && type !== "INFO" ? transactionEventTypeMessages[type] : undefined;
            const displayType = capitalize(
              typeMessage ? intl.formatMessage(typeMessage) : event.message || type || "",
            );

            return (
              <tr key={event.id} data-test-id="transaction-event">
                <td style={{ ...cellStyle, paddingLeft: 48, width: 100, whiteSpace: "nowrap" }}>
                  <EventStatus status={status} />
                </td>
                <td style={cellStyle}>
                  <Text size={2}>{displayType}</Text>
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {event.pspReference && (
                    <Text size={2} color="default2">
                      {event.pspReference}
                    </Text>
                  )}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    width: 100,
                    whiteSpace: "nowrap",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {shouldShowAmount(event.type) ? (
                    <Text size={2}>
                      {intl.formatNumber(event.amount.amount, {
                        style: "currency",
                        currency: event.amount.currency,
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  ) : (
                    <Text size={2} color="default2">
                      —
                    </Text>
                  )}
                </td>
                <td style={{ ...cellStyle, width: 220, textAlign: "right", paddingRight: 24 }}>
                  <EventTime date={event.createdAt} />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
};
