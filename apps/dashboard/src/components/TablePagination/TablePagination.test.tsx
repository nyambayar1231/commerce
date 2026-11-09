// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../Locale/Locale";
import { TablePagination } from "./TablePagination";

afterEach(cleanup);

const renderPagination = (props: Parameters<typeof TablePagination>[0]) =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <TablePagination {...props} />
      </LocaleProvider>
    </MemoryRouter>,
  );

const button = (testId: string) =>
  document.querySelector<HTMLButtonElement>(`[data-test-id="${testId}"]`);

describe("TablePagination", () => {
  it("disables the arrows that have no page behind them", () => {
    renderPagination({ hasPreviousPage: false, hasNextPage: true });

    expect(button("button-pagination-back")?.disabled).toBe(true);
    expect(button("button-pagination-next")?.disabled).toBe(false);
  });

  it("calls the page handlers", () => {
    const onNextPage = vi.fn();
    const onPreviousPage = vi.fn();
    renderPagination({ hasPreviousPage: true, hasNextPage: true, onNextPage, onPreviousPage });

    fireEvent.click(button("button-pagination-next") as HTMLButtonElement);
    fireEvent.click(button("button-pagination-back") as HTMLButtonElement);

    expect(onNextPage).toHaveBeenCalledTimes(1);
    expect(onPreviousPage).toHaveBeenCalledTimes(1);
  });

  it("shows Saleor's row-number label only with list settings", () => {
    renderPagination({ settings: { rowNumber: 20 } });
    expect(screen.getByText("No. of rows")).toBeTruthy();
    cleanup();

    renderPagination({});
    expect(screen.queryByText("No. of rows")).toBeNull();
  });
});
