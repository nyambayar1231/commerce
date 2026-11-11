// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { ProductBulkDeleteDialog } from "./ProductBulkDeleteDialog";

afterEach(cleanup);

const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);
  if (!element) throw new Error(`no element with data-test-id="${id}"`);
  return element;
};

const renderDialog = (props: Partial<Parameters<typeof ProductBulkDeleteDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <LocaleProvider>
      <ProductBulkDeleteDialog
        open
        count={3}
        confirmButtonState="default"
        onClose={onClose}
        onConfirm={onConfirm}
        {...props}
      />
    </LocaleProvider>,
  );

  return { onConfirm, onClose };
};

describe("ProductBulkDeleteDialog", () => {
  it("shows Saleor's title and the plural count", () => {
    renderDialog({ count: 3 });

    expect(screen.getByText("Delete Products")).toBeTruthy();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("uses the singular question for one product", () => {
    renderDialog({ count: 1 });

    expect(screen.getByText("Are you sure you want to delete this product?")).toBeTruthy();
  });

  it("confirms and cancels through the buttons", () => {
    const { onConfirm, onClose } = renderDialog();

    fireEvent.click(byTestId("submit"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(byTestId("back"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
