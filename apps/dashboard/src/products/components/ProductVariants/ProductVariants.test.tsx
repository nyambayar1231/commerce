// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { ThemeProvider } from "../../../theme/provider";
import { ProductVariants } from "./ProductVariants";

afterEach(cleanup);

const renderCard = () => {
  const onAddVariant = vi.fn();
  const onRowClick = vi.fn();

  render(
    <ThemeProvider>
      <LocaleProvider>
        <MemoryRouter>
          <ProductVariants
            variants={[]}
            warehouses={[]}
            onAddVariant={onAddVariant}
            onRowClick={onRowClick}
          />
        </MemoryRouter>
      </LocaleProvider>
    </ThemeProvider>,
  );

  return { onAddVariant, onRowClick };
};

describe("ProductVariants", () => {
  it("shows Saleor's header, empty text and calls the add handler", () => {
    const { onAddVariant } = renderCard();

    expect(screen.getByText("Variants")).toBeTruthy();
    expect(screen.getByText("Use button above to add new product variants")).toBeTruthy();

    const addButton = document.querySelector<HTMLButtonElement>(
      '[data-test-id="button-add-variant"]',
    );
    expect(addButton?.textContent).toContain("Add variant");

    fireEvent.click(addButton as HTMLButtonElement);

    expect(onAddVariant).toHaveBeenCalledTimes(1);
  });
});
