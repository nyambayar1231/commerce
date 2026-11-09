// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { ProductErrorFragment } from "../../../graphql/types.generated";
import { CreateCategoryDialog } from "./CreateCategoryDialog";

afterEach(cleanup);

const renderDialog = (
  props: Partial<Parameters<typeof CreateCategoryDialog>[0]> = {},
  onSubmit = vi.fn(async () => [] as ProductErrorFragment[]),
) => {
  render(
    <LocaleProvider>
      <CreateCategoryDialog
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
const nameInput = () => byTestId<HTMLInputElement>("category-name-input");
const descriptionInput = () => byTestId<HTMLTextAreaElement>("category-description-input");
const createButton = () => byTestId<HTMLButtonElement>("submit");

describe("CreateCategoryDialog", () => {
  it("shows Saleor's title, description and fields for a top-level category", () => {
    renderDialog();

    expect(screen.getByText("Create category")).toBeTruthy();
    expect(
      screen.getByText(
        "Add a top-level category. You can edit SEO, media, and metadata after creating it.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Category Name")).toBeTruthy();
    expect(screen.getByText("Category Description")).toBeTruthy();
  });

  it("titles a child create with the parent's name", () => {
    renderDialog({ parentId: "Q2F0ZWdvcnk6MQ==", parentName: "Apparel" });

    expect(screen.getByText("Create subcategory")).toBeTruthy();
    expect(screen.getByText("Apparel")).toBeTruthy();
  });

  it("keeps Create disabled until the name has text", () => {
    renderDialog();

    expect(createButton().disabled).toBe(true);
    fireEvent.change(nameInput(), { target: { value: "   " } });
    expect(createButton().disabled).toBe(true);
    fireEvent.change(nameInput(), { target: { value: "Shoes" } });
    expect(createButton().disabled).toBe(false);
  });

  it("submits the trimmed name and the description as EditorJS data", async () => {
    const onSubmit = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "  Гутал  " } });
    fireEvent.change(descriptionInput(), { target: { value: "  Winter boots  " } });
    fireEvent.click(createButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Гутал",
      description: { blocks: [{ type: "paragraph", data: { text: "Winter boots" } }] },
    });
  });

  it("sends no description when the field is blank", async () => {
    const onSubmit = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "Shoes" } });
    fireEvent.click(createButton());

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: "Shoes", description: null }),
    );
  });

  it("shows the API's errors after a submit", async () => {
    const errors: ProductErrorFragment[] = [
      {
        __typename: "ProductError",
        code: "UNIQUE",
        field: "slug",
        message: "Category with this Slug already exists.",
      },
    ];
    renderDialog(
      {},
      vi.fn(async () => errors),
    );

    fireEvent.change(nameInput(), { target: { value: "Shoes" } });
    fireEvent.click(createButton());

    expect(await screen.findByText("Category with this Slug already exists.")).toBeTruthy();
  });
});
