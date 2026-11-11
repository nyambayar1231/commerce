// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { SavebarRefProvider } from "../../../components/Savebar/SavebarRefContext";
import { ThemeProvider } from "../../../theme/provider";
import { ProductMediaPage } from "./ProductMediaPage";

afterEach(cleanup);

const media = [
  { id: "media-1", url: "https://example.com/1.webp", alt: "Front" },
  { id: "media-2", url: "https://example.com/2.webp", alt: "Back" },
];

const renderPage = (
  props: Partial<Parameters<typeof ProductMediaPage>[0]> = {},
): ReturnType<typeof vi.fn> => {
  const onSubmit = vi.fn();

  render(
    <ThemeProvider>
      <LocaleProvider>
        <SavebarRefProvider>
          <MemoryRouter>
            <ProductMediaPage
              productId="product-1"
              productName="Hoodie"
              media={media}
              mediaObj={{ id: "media-1", url: "https://example.com/1.jpg", alt: "Front" }}
              errors={[]}
              disabled={false}
              saveButtonBarState="default"
              onDelete={vi.fn()}
              onRowClick={() => () => undefined}
              onSubmit={onSubmit}
              {...props}
            />
          </MemoryRouter>
        </SavebarRefProvider>
      </LocaleProvider>
    </ThemeProvider>,
  );

  return onSubmit;
};

const altInput = (): HTMLTextAreaElement => {
  const element = document.querySelector<HTMLTextAreaElement>(
    'textarea[data-test-id="product-media-alt-input"]',
  );
  if (!element) throw new Error("no alt input");
  return element;
};

describe("ProductMediaPage", () => {
  it("shows the product name, the image, the navigation and the image information card", () => {
    renderPage();

    expect(screen.getByText("Hoodie / Edit Image")).toBeTruthy();
    expect(screen.getByText("Media Information")).toBeTruthy();
    expect(screen.getByText("All Media")).toBeTruthy();
    expect(altInput().value).toBe("Front");
    expect(
      document.querySelector('[data-test-id="product-media-preview"] img')?.getAttribute("src"),
    ).toBe("https://example.com/1.jpg");
  });

  it("submits the typed alt text", () => {
    const onSubmit = renderPage();
    const form = document.querySelector("form");
    if (!form) throw new Error("no form");

    fireEvent.change(altInput(), { target: { value: "A red hoodie" } });
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledWith({ alt: "A red hoodie" });
  });

  it("shows the API's `input` error on the alt field", () => {
    renderPage({
      errors: [
        {
          __typename: "ProductError",
          field: "input",
          code: "INVALID",
          message: "Alt field exceeds the character limit of 250.",
        },
      ],
    });

    expect(screen.getByText("Alt field exceeds the character limit of 250.")).toBeTruthy();
    expect(screen.queryByText("Optional")).toBeNull();
  });
});
