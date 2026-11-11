import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import { getPlacedDate } from "./placedDate";

const intl = createIntl({ locale: "en" });
const now = new Date(2026, 10, 11, 15, 0, 0);
const at = (...args: [number, number, number, number, number]) => new Date(...args).toISOString();

describe("getPlacedDate", () => {
  it("uses Saleor's recency buckets", () => {
    expect(getPlacedDate(at(2026, 10, 11, 14, 59), intl, now).label).toBe("Placed 1 minute ago");
    expect(getPlacedDate(new Date(now.getTime() - 20_000).toISOString(), intl, now).label).toBe(
      "Placed just now",
    );
    expect(getPlacedDate(at(2026, 10, 11, 9, 5), intl, now).label).toBe("Placed today at 9:05 AM");
    expect(getPlacedDate(at(2026, 10, 10, 9, 5), intl, now).label).toBe(
      "Placed yesterday at 9:05 AM",
    );
    expect(getPlacedDate(at(2026, 2, 3, 9, 5), intl, now).label).toBe("Placed Mar 3 at 9:05 AM");
    expect(getPlacedDate(at(2025, 2, 3, 9, 5), intl, now).label).toBe("Placed Mar 3, 2025");
  });

  it("gives the full date as the tooltip", () => {
    expect(getPlacedDate(at(2025, 2, 3, 9, 5), intl, now).tooltip).toContain("Mar 3, 2025");
  });
});
