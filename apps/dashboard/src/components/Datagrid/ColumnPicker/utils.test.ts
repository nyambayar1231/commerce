// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { AvailableColumn } from "../types";
import { isLastEnabledColumn, mergeSelectedColumns } from "./utils";

const columns: AvailableColumn[] = [
  { id: "name", title: "Name", width: 280 },
  { id: "price", title: "Price", width: 140 },
  { id: "created", title: "Created at", width: 200 },
];

describe("column picker utils", () => {
  it("locks the last enabled static column, as Saleor does", () => {
    expect(isLastEnabledColumn("name", columns, ["name"])).toBe(true);
    expect(isLastEnabledColumn("name", columns, ["name", "price"])).toBe(false);
    expect(isLastEnabledColumn("price", columns, ["name", "price"])).toBe(false);
  });

  it("merges selected ids into columns, keeping their order and dropping unknown ids", () => {
    expect(
      mergeSelectedColumns({ staticColumns: columns, selectedColumns: ["created", "gone"] }),
    ).toEqual([columns[2]]);
  });
});
