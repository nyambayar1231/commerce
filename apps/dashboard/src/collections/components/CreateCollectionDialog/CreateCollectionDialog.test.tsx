// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { CollectionErrorFragment } from "../../../graphql/types.generated";
import { CreateCollectionDialog } from "./CreateCollectionDialog";

afterEach(cleanup);

const renderDialog = (
  props: Partial<Parameters<typeof CreateCollectionDialog>[0]> = {},
  onSubmit = vi.fn(async () => [] as CollectionErrorFragment[]),
) => {
  render(
    <LocaleProvider>
      <CreateCollectionDialog
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
const nameInput = () => byTestId<HTMLInputElement>("collection-name-input");
const createButton = () => byTestId<HTMLButtonElement>("submit");

describe("CreateCollectionDialog", () => {
  it("shows Saleor's title, description and the name field", () => {
    renderDialog();

    expect(screen.getByText("Create collection")).toBeTruthy();
    expect(
      screen.getByText(
        "Add a collection. You can edit channels, SEO, media, and metadata after creating it.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Collection Name")).toBeTruthy();
  });

  it("submits the trimmed name", async () => {
    const onSubmit = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "  Гутал  " } });
    fireEvent.click(createButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Гутал" });
  });

  it("shows the API's error for a blank name under the input", async () => {
    const errors: CollectionErrorFragment[] = [
      {
        __typename: "CollectionError",
        code: "REQUIRED",
        field: "name",
        message: "This field cannot be blank.",
      },
    ];
    const onSubmit = renderDialog(
      // The mutation's result carries the same error as the submit's return value.
      { errors },
      vi.fn(async () => errors),
    );

    fireEvent.click(createButton());

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "" }));
    // Shown once even though the same error comes back through the mutation result as well.
    expect(screen.getAllByText("This field cannot be blank.")).toHaveLength(1);
  });

  it("does not show Apollo's earlier errors until this session submits", () => {
    renderDialog({
      errors: [
        {
          __typename: "CollectionError",
          code: "UNIQUE",
          field: "name",
          message: "Collection with this name already exists.",
        },
      ],
    });

    expect(screen.queryByText("Collection with this name already exists.")).toBeNull();
  });
});
