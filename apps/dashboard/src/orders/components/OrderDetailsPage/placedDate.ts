// Adapted from saleor-dashboard: src/components/Date/MerchantDate.tsx getMerchantDate and
// MerchantDate.messages.ts (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// The order header's "Placed …" label and its full-date tooltip, for the "placed" kind only (no
// draft or unconfirmed orders) and in the browser's time zone (Saleor's timezone setting is not
// built).
import { defineMessage, type IntlShape } from "react-intl";

// react-intl's defineMessages cannot infer values; each message is typed on its own.
const messages = {
  placedJustNow: defineMessage({
    id: "6fIHWa",
    defaultMessage: "Placed just now",
    description: "order header date, less than a minute ago",
  }),
  placedMinutesAgo: defineMessage<{ minutes: number }>({
    id: "G2WJ1J",
    defaultMessage: "Placed {minutes, plural, one {# minute} other {# minutes}} ago",
    description: "order header date, less than an hour ago",
  }),
  placedToday: defineMessage<{ time: string }>({
    id: "a4iag6",
    defaultMessage: "Placed today at {time}",
    description: "order header date, earlier today",
  }),
  placedYesterday: defineMessage<{ time: string }>({
    id: "ULBvyx",
    defaultMessage: "Placed yesterday at {time}",
    description: "order header date, yesterday",
  }),
  placedThisYear: defineMessage<{ date: string; time: string }>({
    id: "zmKgYS",
    defaultMessage: "Placed {date} at {time}",
    description: "order header date, same year and older than yesterday",
  }),
  placedOn: defineMessage<{ date: string }>({
    id: "rGj6RR",
    defaultMessage: "Placed {date}",
    description: "order header date, older than yesterday",
  }),
};

const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;

const dayKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const getPlacedDate = (
  date: string,
  intl: IntlShape,
  now: Date = new Date(),
): { label: string; tooltip: string } => {
  const target = new Date(date);
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - target.getTime()) / 1000));
  const tooltip = intl.formatDate(target, { dateStyle: "medium", timeStyle: "long" });

  if (diffSeconds < SECONDS_IN_MINUTE) {
    return { label: intl.formatMessage(messages.placedJustNow), tooltip };
  }

  if (diffSeconds < SECONDS_IN_HOUR) {
    const minutes = Math.floor(diffSeconds / SECONDS_IN_MINUTE);

    return { label: intl.formatMessage(messages.placedMinutesAgo, { minutes }), tooltip };
  }

  const time = intl.formatTime(target, { timeStyle: "short" });
  const yesterday = new Date(now);

  yesterday.setDate(now.getDate() - 1);

  if (dayKey(target) === dayKey(now)) {
    return { label: intl.formatMessage(messages.placedToday, { time }), tooltip };
  }

  if (dayKey(target) === dayKey(yesterday)) {
    return { label: intl.formatMessage(messages.placedYesterday, { time }), tooltip };
  }

  if (target.getFullYear() === now.getFullYear()) {
    const formattedDate = intl.formatDate(target, { day: "numeric", month: "short" });

    return {
      label: intl.formatMessage(messages.placedThisYear, { date: formattedDate, time }),
      tooltip,
    };
  }

  return {
    label: intl.formatMessage(messages.placedOn, {
      date: intl.formatDate(target, { dateStyle: "medium" }),
    }),
    tooltip,
  };
};
