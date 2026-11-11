// Copied from saleor-dashboard: src/components/Timeline/groupEventsByDate.ts (BSD-3-Clause,
// Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
export type TimelineDateGroupKey =
  | "TODAY"
  | "YESTERDAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "OLDER"
  | "UNKNOWN";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const startOfDay = (date: Date): Date => {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
};

/**
 * Whole local calendar days between `from` and `to` (to ≥ from).
 * Avoids splitting one calendar day across buckets when using elapsed hours.
 */
const calendarDaysBetween = (from: Date, to: Date): number =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);

/** Smart grouping key based on calendar-day age. */
export const getDateGroupKey = (
  date: string | null | undefined,
  now: Date = new Date(),
): TimelineDateGroupKey => {
  if (!date) {
    return "UNKNOWN";
  }

  const eventDate = new Date(date);

  if (Number.isNaN(eventDate.getTime())) {
    return "UNKNOWN";
  }

  const daysAgo = calendarDaysBetween(eventDate, now);

  if (daysAgo <= 0) {
    return "TODAY";
  }

  if (daysAgo === 1) {
    return "YESTERDAY";
  }

  if (daysAgo < 7) {
    return "LAST_7_DAYS";
  }

  if (daysAgo < 30) {
    return "LAST_30_DAYS";
  }

  return "OLDER";
};

/** Group events by date bucket — preserves insertion order of groups and items. */
export const groupEventsByDate = <T extends { date?: unknown }>(
  events: T[],
  now: Date = new Date(),
): Array<[TimelineDateGroupKey, T[]]> => {
  const groups: Array<[TimelineDateGroupKey, T[]]> = [];
  const groupMap = new Map<TimelineDateGroupKey, number>();

  for (const event of events) {
    const key = getDateGroupKey(typeof event.date === "string" ? event.date : null, now);
    let index = groupMap.get(key);

    if (index === undefined) {
      index = groups.length;
      groupMap.set(key, index);
      groups.push([key, []]);
    }

    groups[index]?.[1].push(event);
  }

  return groups;
};
