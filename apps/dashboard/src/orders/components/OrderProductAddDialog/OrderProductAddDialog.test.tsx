// @vitest-environment jsdom
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { SearchOrderVariantDocument } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { OrderProductAddDialog } from "./OrderProductAddDialog";

afterEach(cleanup);

const variant = (id: string, name: string, sku: string) => ({
  __typename: "ProductVariant" as const,
  id,
  name,
  sku,
  price: { __typename: "Money" as const, amount: 45000, currency: "MNT" },
});

const searchMock = {
  request: { query: SearchOrderVariantDocument, variables: { first: 20, query: "" } },
  result: {
    data: {
      __typename: "Query",
      products: {
        __typename: "ProductCountableConnection",
        edges: [
          {
            __typename: "ProductCountableEdge",
            node: {
              __typename: "Product",
              id: "p1",
              name: "Boots",
              thumbnail: null,
              variants: [variant("v1", "42", "B-42"), variant("v2", "43", "B-43")],
            },
          },
        ],
      },
    },
  },
};

const renderDialog = () => {
  const onSubmit = vi.fn();
  render(
    <MockedProvider mocks={[searchMock]}>
      <ThemeProvider>
        <LocaleProvider>
          <OrderProductAddDialog
            open
            confirmButtonState="default"
            errors={[]}
            onClose={vi.fn()}
            onSubmit={onSubmit}
          />
        </LocaleProvider>
      </ThemeProvider>
    </MockedProvider>,
  );
  return onSubmit;
};

describe("OrderProductAddDialog", () => {
  it("lists products with their variants as Saleor's table rows", async () => {
    renderDialog();

    expect(await screen.findByText("Boots")).toBeTruthy();
    expect(document.querySelectorAll('[data-test-id="variant"]')).toHaveLength(2);
    expect(screen.getByText("SKU B-42")).toBeTruthy();
    expect(document.querySelectorAll('[data-test-id="money-value"]')[0]?.textContent).toBe(
      "MNT45,000",
    );
  });

  it("selects every variant with the product checkbox and submits them", async () => {
    const onSubmit = renderDialog();
    const confirm = () =>
      document.querySelector<HTMLButtonElement>('[data-test-id="confirm-button"]');

    fireEvent.click(await screen.findByRole("checkbox", { name: "Boots" }));
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Boots 42" }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Boots 43" }).checked).toBe(true);

    // Unticking one variant unticks the product.
    fireEvent.click(screen.getByRole("checkbox", { name: "Boots 43" }));
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: "Boots" }).checked).toBe(false);

    confirm()?.click();
    expect(onSubmit).toHaveBeenCalledWith([expect.objectContaining({ id: "v1" })]);
  });
});
