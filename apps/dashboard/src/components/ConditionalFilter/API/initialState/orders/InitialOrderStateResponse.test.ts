import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";

import { FilterElement } from "../../../FilterElement/FilterElement";
import { TokenArray } from "../../../ValueProvider/TokenArray";
import { getOrderStatusOptions, InitialOrderStateResponse } from "./InitialOrderStateResponse";

const intl = createIntl({ locale: "en" });
const response = new InitialOrderStateResponse(getOrderStatusOptions(intl));

const rowsOf = (search: string) =>
  new TokenArray(search).asFilterValuesFromResponse(response).filter(FilterElement.isFilterElement);

describe("order status filter from the URL", () => {
  it("offers every status with the pills' labels", () => {
    expect(getOrderStatusOptions(intl).map((option) => option.label)).toEqual([
      "Unfulfilled",
      "Partially fulfilled",
      "Fulfilled",
      "Cancelled",
    ]);
  });

  it("shows the labels for `is` and `in` rows", () => {
    const [isRow] = rowsOf("0[s0.status]=FULFILLED");
    const [inRow] = rowsOf("0[s2.status][0]=UNFULFILLED&0[s2.status][1]=CANCELED");

    expect(isRow?.value.label).toBe("Order Status");
    expect(isRow?.condition.selected.value).toEqual({
      label: "Fulfilled",
      value: "FULFILLED",
      slug: "FULFILLED",
    });
    expect(inRow?.condition.selected.value).toEqual([
      { label: "Unfulfilled", value: "UNFULFILLED", slug: "UNFULFILLED" },
      { label: "Cancelled", value: "CANCELED", slug: "CANCELED" },
    ]);
  });

  it("drops a row naming an unknown status", () => {
    expect(rowsOf("0[s0.status]=DRAFT")).toEqual([]);
  });

  it("writes the row back as the same URL entry", () => {
    const [row] = rowsOf("0[s0.status]=FULFILLED");

    expect(row?.asUrlEntry()).toEqual({ "s0.status": "FULFILLED" });
  });
});
