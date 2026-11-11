// Adapted from saleor-dashboard: src/orders/components/OrderHistory/OrderHistory.tsx, messages.ts
// and src/components/Timeline/TimelineEvent.tsx, TimelineEventHeader.tsx,
// TimelineDateGroupHeader.tsx, TimelineStem.tsx (BSD-3-Clause, Copyright (c) 2020-2021,
// Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// "Order History": the events newest first, grouped by Saleor's date buckets (Today, Yesterday…),
// each with its icon, message, "by <staff>" and time. Left out: notes (owner decision 4 of M6), the
// docs link, expandable event details, the raw-event tooltip and Saleor's relative times ("2 hours
// ago"); the time is printed as a short date and time. Only PLACED exists so far; M6.4 adds the
// fulfil, cancel, mark-as-paid and refund events.
import { Box, Text } from "@saleor/macaw-ui";
import { CircleIcon, type LucideIcon, ShoppingCartIcon } from "lucide-react";
import { FormattedMessage, type IntlShape, useIntl } from "react-intl";

import { DashboardCard } from "../../../components/Card";
import type { OrderEventFragment, OrderEventsEnum } from "../../../graphql/types.generated";
import { getUserName } from "../../../misc";
import { groupEventsByDate, type TimelineDateGroupKey } from "./groupEventsByDate";

const eventIconMap: Partial<Record<OrderEventsEnum, LucideIcon>> = {
  PLACED: ShoppingCartIcon,
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

const EventIcon = ({ type }: { type: OrderEventsEnum | null }) => {
  const Icon = (type && eventIconMap[type]) || CircleIcon;

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
      backgroundColor="default1"
      borderColor="default1"
      color="default2"
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
}: {
  event: OrderEventFragment;
  isLastInGroup: boolean;
}) => {
  const intl = useIntl();
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

export const OrderHistory = ({ history }: { history: OrderEventFragment[] }) => {
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
                />
              ))}
            </Box>
          ))}
        </Box>
      </DashboardCard.Content>
    </DashboardCard>
  );
};
