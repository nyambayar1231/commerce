// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { ProductVariantDeleteDialog } from "./ProductVariantDeleteDialog";

afterEach(cleanup);

const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);
  if (!element) throw new Error(`no element with data-test-id="${id}"`);
  return element;
};

const renderDialog = (props: Partial<Parameters<typeof ProductVariantDeleteDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <LocaleProvider>
      <ProductVariantDeleteDialog
        open
        name="Size 39"
        confirmButtonState="default"
        onClose={onClose}
        onConfirm={onConfirm}
        {...props}
      />
    </LocaleProvider>,
  );

  return { onConfirm, onClose };
};

describe("ProductVariantDeleteDialog", () => {
  it("shows Saleor's title and the variant name", () => {
    renderDialog();

    expect(screen.getByText("Delete Variant")).toBeTruthy();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeTruthy();
    expect(screen.getByText("Size 39")).toBeTruthy();
  });

  it("confirms and cancels through the buttons", () => {
    const { onConfirm, onClose } = renderDialog();

    fireEvent.click(byTestId("delete-variant-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(byTestId("back"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks the dialog while the deletion is loading", () => {
    const { onClose } = renderDialog({ confirmButtonState: "loading" });

    const back = byTestId<HTMLButtonElement>("back");
    expect(back.disabled).toBe(true);

    fireEvent.click(back);
    expect(onClose).not.toHaveBeenCalled();
  });
});
