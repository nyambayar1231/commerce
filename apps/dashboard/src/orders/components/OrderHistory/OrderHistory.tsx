// Adapted from saleor-dashboard: src/orders/components/OrderHistory/OrderHistory.tsx, messages.ts
// and src/components/Timeline/TimelineEvent.tsx, TimelineEventHeader.tsx,
// TimelineDateGroupHeader.tsx, TimelineStem.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Order History": the events newest first, grouped by Saleor's date buckets (Today, Yesterday…),
// each with its icon, message, "by <staff>" and time. Left out: notes (owner decision 4 of M6), the
// docs link, expandable event details, the raw-event tooltip and Saleor's relative times ("2 hours
// ago"); the time is printed as a short date and time. An event's details (fulfilled items, the
// payment reference, the refunded amount) are a line under its title instead of Saleor's
// expandable panel.
import { Box, Text } from "@saleor/macaw-ui";
import {
  CheckCircleIcon,
  CircleIcon,
  type LucideIcon,
  PackageIcon,
  RotateCcwIcon,
  ShoppingCartIcon,
  XIcon,
} from "lucide-react";
import { FormattedMessage, type IntlShape, useIntl } from "react-intl";

import { DashboardCard } from "../../../components/Card";
import type { OrderEventFragment, OrderEventsEnum } from "../../../graphql/types.generated";
import { getStatusColor, getUserName, type StatusType } from "../../../misc";
import { useTheme } from "../../../theme/hook";
import { groupEventsByDate, type TimelineDateGroupKey } from "./groupEventsByDate";

// Saleor's eventIconMap and eventStatusMap for our event types (Saleor's refund icon is custom;
// lucide's RotateCcw stands in).
const eventIconMap: Partial<Record<OrderEventsEnum, LucideIcon>> = {
  PLACED: ShoppingCartIcon,
  PLACED_FROM_DRAFT: ShoppingCartIcon,
  FULFILLMENT_FULFILLED_ITEMS: PackageIcon,
  CANCELED: XIcon,
  ORDER_MARKED_AS_PAID: CheckCircleIcon,
  TRANSACTION_REFUND_REQUESTED: RotateCcwIcon,
};

const eventStatusMap: Partial<Record<OrderEventsEnum, StatusType>> = {
  FULFILLMENT_FULFILLED_ITEMS: "success",
  ORDER_MARKED_AS_PAID: "success",
  TRANSACTION_REFUND_REQUESTED: "info",
  CANCELED: "error",
};

/** Saleor's getEventMessage, for the event types our API has. */
export const getEventMessage = (event: Pick<OrderEventFragment, "type">, intl: IntlShape) => {
  switch (event.type) {
    case "PLACED":
      return intl.formatMessage({
        id: "GJAX0z",
        defaultMessage: "Order was placed",
        description: "order history message",
      });
    case "DRAFT_CREATED":
      return intl.formatMessage({
        id: "hWO1SD",
        defaultMessage: "Draft order was created",
        description: "order history message",
      });
    case "ADDED_PRODUCTS":
      return intl.formatMessage({
        id: "mWYRZY",
        defaultMessage: "Products were added to the order",
        description: "order history message",
      });
    case "REMOVED_PRODUCTS":
      return intl.formatMessage({
        id: "6GTAm2",
        defaultMessage: "Products were deleted from the order",
        description: "order history message",
      });
    case "PLACED_FROM_DRAFT":
      return intl.formatMessage({
        id: "OKGd/k",
        defaultMessage: "Order was created from draft",
        description: "order history message",
      });
    case "FULFILLMENT_FULFILLED_ITEMS":
      return intl.formatMessage({
        id: "x1k81A",
        defaultMessage: "Items were fulfilled",
        description: "order history message",
      });
    case "CANCELED":
      return intl.formatMessage({
        id: "zRrcOG",
        defaultMessage: "Order was cancelled",
        description: "order history message",
      });
    case "ORDER_MARKED_AS_PAID":
      return intl.formatMessage({
        id: "fkplbE",
        defaultMessage: "Order was marked as paid",
        description: "order history message",
      });
    case "TRANSACTION_REFUND_REQUESTED":
      return intl.formatMessage({
        id: "fqJXzO",
        defaultMessage: "Transaction refund requested",
        description: "order history message",
      });
    default:
      // As Saleor: an event type without a message renders no title.
      return "";
  }
};

const groupLabel = (key: TimelineDateGroupKey, isSoleGroup: boolean, intl: IntlShape) => {
  switch (key) {
    case "TODAY":
      return intl.formatMessage({ id: "zWgbGg", defaultMessage: "Today" });
    case "YESTERDAY":
      return intl.formatMessage({
        id: "IradBW",
        defaultMessage: "Yesterday",
        description: "date group header",
      });
    case "LAST_7_DAYS":
      return intl.formatMessage({
        id: "0/Y0nG",
        defaultMessage: "Last 7 days",
        description: "date group header",
      });
    case "LAST_30_DAYS":
      return intl.formatMessage({
        id: "4kcpaI",
        defaultMessage: "Last 30 days",
        description: "date group header",
      });
    case "OLDER":
      return isSoleGroup
        ? intl.formatMessage({
            id: "8RDDZP",
            defaultMessage: "Older than 30 days",
            description: "date group header when it is the only group on the timeline",
          })
        : intl.formatMessage({
            id: "LU8dtl",
            defaultMessage: "Older",
            description: "date group header",
          });
    default:
      return intl.formatMessage({
        id: "yn7Stx",
        defaultMessage: "Unknown",
        description: "date group header",
      });
  }
};

/** The details line under an event's title, or null when it has none. */
export const getEventDetails = (
  event: Pick<OrderEventFragment, "fulfilledItems" | "transactionReference" | "amount" | "lines">,
  intl: IntlShape,
  currency: string,
): string | null => {
  // The lines an ADDED_PRODUCTS / REMOVED_PRODUCTS event names (Saleor's ExtendedTimelineEvent).
  if (event.lines && event.lines.length > 0) {
    return event.lines.map((line) => `${line.quantity ?? 0} × ${line.itemName ?? ""}`).join(", ");
  }
  if (event.fulfilledItems && event.fulfilledItems.length > 0) {
    return event.fulfilledItems
      .map((item) => {
        const line = item.orderLine;
        const name = line
          ? line.variantName
            ? `${line.productName} (${line.variantName})`
            : line.productName
          : "";
        return `${item.quantity} × ${name}`;
      })
      .join(", ");
  }
  // A refund shows its amount (Saleor's extended refund event); mark as paid its reference.
  if (event.amount !== null) {
    return intl.formatNumber(event.amount, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
  }
  if (event.transactionReference) {
    return `${intl.formatMessage({ id: "jGvclB", defaultMessage: "Transaction Reference" })}: ${event.transactionReference}`;
  }
  return null;
};

const EventIcon = ({ type }: { type: OrderEventsEnum | null }) => {
  const { theme } = useTheme();
  const Icon = (type && eventIconMap[type]) || CircleIcon;
  const status = type ? eventStatusMap[type] : undefined;
  const colors = status ? getStatusColor({ status, currentTheme: theme }) : null;

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      borderRadius="100%"
      borderStyle="solid"
      borderWidth={1}
      __width="32px"
      __height="32px"
      flexShrink="0"
      __backgroundColor={colors?.base}
      __borderColor={colors?.border}
      __color={colors?.text}
      backgroundColor={colors ? undefined : "default1"}
      borderColor={colors ? undefined : "default1"}
      color={colors ? undefined : "default2"}
    >
      {Icon === CircleIcon ? (
        <CircleIcon size={8} fill="currentColor" color="currentColor" />
      ) : (
        <Icon size={16} color="currentColor" />
      )}
    </Box>
  );
};

const TimelineEvent = ({
  event,
  isLastInGroup,
  currency,
}: {
  event: OrderEventFragment;
  isLastInGroup: boolean;
  currency: string;
}) => {
  const intl = useIntl();
  const details = getEventDetails(event, intl, currency);
  const actorName = getUserName(event.user, true);
  const date = typeof event.date === "string" ? new Date(event.date) : null;

  return (
    <Box display="flex" width="100%" position="relative" data-test-id="order-history-event">
      {!isLastInGroup ? (
        <Box
          as="span"
          position="absolute"
          __left="calc(var(--mu-spacing-10) / 2)"
          __width="1px"
          __transform="translateX(-50%)"
          __top="32px"
          __bottom="-20px"
          backgroundColor="default1Hovered"
          aria-hidden
        />
      ) : null}
      <Box display="flex" alignItems="center" width="100%" gap={2} marginBottom={5}>
        <Box width={10} display="flex" justifyContent="center" flexShrink="0" __zIndex="1">
          <EventIcon type={event.type} />
        </Box>
        <Box
          width="100%"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          __minHeight="32px"
        >
          <Box display="flex" flexDirection="column">
            <Box display="flex" alignItems="center" flexWrap="wrap">
              <Text size={3} color="default1">
                {getEventMessage(event, intl)}
              </Text>
              {actorName && (
                <Text size={3} color="default2" as="span" marginLeft={1}>
                  by {actorName}
                </Text>
              )}
            </Box>
            {details && (
              <Text size={2} color="default2" data-test-id="order-history-event-details">
                {details}
              </Text>
            )}
          </Box>
          {date && !Number.isNaN(date.getTime()) && (
            <Text size={2} color="default2" whiteSpace="nowrap">
              {intl.formatDate(date, { dateStyle: "medium", timeStyle: "short" })}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export const OrderHistory = ({
  history,
  currency,
}: {
  history: OrderEventFragment[];
  currency: string;
}) => {
  const intl = useIntl();
  const groups = groupEventsByDate(history.slice().reverse());

  return (
    <DashboardCard>
      <DashboardCard.Header flexDirection="column" alignItems="start" paddingTop={0}>
        <DashboardCard.Title>
          <FormattedMessage id="XBfvKN" defaultMessage="Order History" />
        </DashboardCard.Title>
      </DashboardCard.Header>
      <DashboardCard.Content>
        <Box position="relative">
          {groups.map(([key, events]) => (
            <Box key={key}>
              <Box paddingY={3}>
                <Text
                  size={2}
                  fontWeight="medium"
                  color="default2"
                  style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {groupLabel(key, groups.length === 1, intl)}
                </Text>
              </Box>
              {events.map((event, index) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  isLastInGroup={index === events.length - 1}
                  currency={currency}
                />
              ))}
            </Box>
          ))}
        </Box>
      </DashboardCard.Content>
    </DashboardCard>
  );
};
