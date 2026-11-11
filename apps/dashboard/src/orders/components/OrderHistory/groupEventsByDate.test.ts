import { describe, expect, it } from "vitest";

import { getDateGroupKey, groupEventsByDate } from "./groupEventsByDate";

const now = new Date(2026, 10, 11, 15, 0, 0);
const daysAgo = (days: number) => new Date(2026, 10, 11 - days, 10, 0, 0).toISOString();

describe("groupEventsByDate", () => {
  it("buckets by calendar days", () => {
    expect(getDateGroupKey(daysAgo(0), now)).toBe("TODAY");
    expect(getDateGroupKey(daysAgo(1), now)).toBe("YESTERDAY");
    expect(getDateGroupKey(daysAgo(6), now)).toBe("LAST_7_DAYS");
    expect(getDateGroupKey(daysAgo(29), now)).toBe("LAST_30_DAYS");
    expect(getDateGroupKey(daysAgo(30), now)).toBe("OLDER");
    expect(getDateGroupKey(null, now)).toBe("UNKNOWN");
  });

  it("keeps the order of groups and events", () => {
    const events = [
      { id: "a", date: daysAgo(0) },
      { id: "b", date: daysAgo(0) },
      { id: "c", date: daysAgo(3) },
    ];

    expect(
      groupEventsByDate(events, now).map(([key, items]) => [key, items.map((e) => e.id)]),
    ).toEqual([
      ["TODAY", ["a", "b"]],
      ["LAST_7_DAYS", ["c"]],
    ]);
  });
});
