// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { CreateProductDialog } from "./CreateProductDialog";

// The category picker normally queries Apollo; the dialog test only cares that its selection
// reaches onSubmit.
vi.mock("../../../searches/useCategorySearch", () => ({
  useCategorySearch: () => ({
    categories: [{ value: "Q2F0ZWdvcnk6MQ==", label: "Shoes" }],
    loading: false,
    hasNextPage: false,
    search: () => {},
    loadMore: () => {},
  }),
}));

afterEach(cleanup);

const renderDialog = (
  props: Partial<Parameters<typeof CreateProductDialog>[0]> = {},
  onSubmit = vi.fn(async () => [] as ProductErrorFragment[]),
) => {
  render(
    <LocaleProvider>
      <CreateProductDialog
        open
        confirmButtonState="default"
        errors={[]}
        onClose={() => {}}
        onSubmit={onSubmit}
        {...props}
      />
    </LocaleProvider>,
  );
  return onSubmit;
};

// Saleor tags elements with `data-test-id` (not Testing Library's `data-testid`); the modal renders
// in a portal, so query the whole document.
const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);
  if (!element) throw new Error(`no element with data-test-id="${id}"`);
  return element;
};
const nameInput = () => byTestId<HTMLInputElement>("product-name-input");
const categoryInput = () => byTestId<HTMLInputElement>("product-category");
const createButton = () => byTestId<HTMLButtonElement>("submit");

describe("CreateProductDialog", () => {
  it("shows the title, description and fields", () => {
    renderDialog();

    expect(screen.getByText("Create product")).toBeTruthy();
    expect(
      screen.getByText(
        "Add a product. You can set a price, inventory, and availability after creating it.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Category")).toBeTruthy();
  });

  it("keeps Create disabled until the name has text", () => {
    renderDialog();

    expect(createButton().disabled).toBe(true);
    fireEvent.change(nameInput(), { target: { value: "   " } });
    expect(createButton().disabled).toBe(true);
    fireEvent.change(nameInput(), { target: { value: "Boots" } });
    expect(createButton().disabled).toBe(false);
  });

  it("submits the trimmed name and the selected category", async () => {
    const onSubmit = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "  Winter boots  " } });

    fireEvent.focus(categoryInput());
    fireEvent.click(categoryInput());
    fireEvent.click(await screen.findByText("Shoes"));

    fireEvent.click(createButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Winter boots",
      category: "Q2F0ZWdvcnk6MQ==",
    });
  });

  it("submits without a category when none is selected", async () => {
    const onSubmit = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "Boots" } });
    fireEvent.click(createButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Boots", category: null }));
  });

  it("shows the API's name error on the name input", async () => {
    const errors: ProductErrorFragment[] = [
      {
        __typename: "ProductError",
        code: "REQUIRED",
        field: "name",
        message: "This field is required.",
      },
    ];
    renderDialog(
      {},
      vi.fn(async () => errors),
    );

    fireEvent.change(nameInput(), { target: { value: "Boots" } });
    fireEvent.click(createButton());

    expect(await screen.findByText("This field is required")).toBeTruthy();
  });
});
