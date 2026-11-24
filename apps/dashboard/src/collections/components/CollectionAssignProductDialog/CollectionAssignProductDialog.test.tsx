// @vitest-environment jsdom
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { CollectionAssignProductSearchDocument } from "../../../graphql/types.generated";
import { CollectionAssignProductDialog } from "./CollectionAssignProductDialog";

afterEach(cleanup);

const searchMock = (collections: { id: string }[]) => ({
  request: {
    query: CollectionAssignProductSearchDocument,
    variables: { first: 20, search: "" },
  },
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
              id: "product-1",
              name: "Hat",
              thumbnail: null,
              collections,
            },
          },
          {
            __typename: "ProductCountableEdge",
            node: {
              __typename: "Product",
              id: "product-2",
              name: "Shoe",
              thumbnail: { __typename: "Image", url: "https://example.com/shoe.png" },
              collections: [],
            },
          },
        ],
        pageInfo: {
          __typename: "PageInfo",
          endCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
        },
      },
    },
  },
});

const renderDialog = (collections: { id: string }[] = [], onAssign = vi.fn()) => {
  render(
    <MockedProvider mocks={[searchMock(collections)]}>
      <LocaleProvider>
        <CollectionAssignProductDialog
          collectionId="collection-1"
          confirmButtonState="default"
          errors={[]}
          open
          onClose={() => {}}
          onAssign={onAssign}
        />
      </LocaleProvider>
    </MockedProvider>,
  );

  return onAssign;
};

// Saleor tags elements with `data-test-id` (not Testing Library's `data-testid`); the modal renders
// in a portal, so query the whole document.
const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);
  if (!element) throw new Error(`no element with data-test-id="${id}"`);
  return element;
};
const assignButton = () => byTestId<HTMLButtonElement>("confirm-button");
const productCheckbox = (name: string) =>
  screen.getByLabelText<HTMLInputElement>(name) as HTMLInputElement;

describe("CollectionAssignProductDialog", () => {
  it("searches the catalogue and lists each product with its checkbox", async () => {
    renderDialog();

    expect(screen.getByText("Assign product")).toBeTruthy();

    await screen.findByText("Hat");
    expect(screen.getByText("Shoe")).toBeTruthy();
    expect(document.querySelector('[data-test-id="empty-image"]')).toBeTruthy();
    expect(document.querySelector('[data-test-id="product-thumbnail"]')?.getAttribute("src")).toBe(
      "https://example.com/shoe.png",
    );
  });

  it("shows the products already in the collection checked and disabled", async () => {
    renderDialog([{ id: "collection-1" }]);

    await screen.findByText("Hat");

    expect(productCheckbox("Hat").checked).toBe(true);
    expect(productCheckbox("Hat").disabled).toBe(true);
    expect(productCheckbox("Shoe").checked).toBe(false);
    expect(productCheckbox("Shoe").disabled).toBe(false);
  });

  it("assigns the selected products", async () => {
    const onAssign = renderDialog();

    await screen.findByText("Shoe");

    expect(assignButton().disabled).toBe(true);

    fireEvent.click(productCheckbox("Shoe"));

    await waitFor(() => expect(assignButton().disabled).toBe(false));

    fireEvent.click(assignButton());

    expect(onAssign).toHaveBeenCalledWith(["product-2"]);
  });

  it("leaves the assigned products out of the assignment", async () => {
    const onAssign = renderDialog([{ id: "collection-1" }]);

    await screen.findByText("Hat");

    fireEvent.click(productCheckbox("Shoe"));
    fireEvent.click(assignButton());

    expect(onAssign).toHaveBeenCalledWith(["product-2"]);
  });
});
