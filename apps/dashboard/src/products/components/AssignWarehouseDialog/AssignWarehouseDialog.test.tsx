// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import type { WarehouseFragment } from "../../../graphql/types.generated";
import { AssignWarehouseDialog } from "./AssignWarehouseDialog";

afterEach(cleanup);

const warehouse = (id: string, name: string): WarehouseFragment => ({
  __typename: "Warehouse",
  id,
  name,
});

const warehouses = [warehouse("w1", "Main warehouse"), warehouse("w2", "Returns")];

const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);
  if (!element) throw new Error(`no element with data-test-id="${id}"`);
  return element;
};

const renderDialog = (props: Partial<Parameters<typeof AssignWarehouseDialog>[0]> = {}) => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  render(
    <LocaleProvider>
      <AssignWarehouseDialog
        open
        warehouses={warehouses}
        onSubmit={onSubmit}
        onClose={onClose}
        {...props}
      />
    </LocaleProvider>,
  );

  return { onSubmit, onClose };
};

describe("AssignWarehouseDialog", () => {
  it("shows Saleor's title and one checkbox per warehouse", () => {
    renderDialog();

    expect(screen.getByText("Assign Warehouses")).toBeTruthy();
    expect(screen.getByText("Main warehouse")).toBeTruthy();
    expect(screen.getByText("Returns")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("excludes the warehouses the variant already has stock in", () => {
    renderDialog({ excludeContainer: (warehouse) => warehouse.id === "w1" });

    expect(screen.queryByText("Main warehouse")).toBeNull();
    expect(screen.getByText("Returns")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("says there is nothing to add when every warehouse is already stocked", () => {
    renderDialog({ excludeContainer: () => true });

    expect(screen.getByText("No warehouses available to add")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("confirms the checked warehouses and closes", () => {
    const { onSubmit, onClose } = renderDialog();

    const confirm = byTestId<HTMLButtonElement>("assign-and-save-button");
    expect(confirm.disabled).toBe(true);

    fireEvent.click(within(byTestId<HTMLElement>("Returns")).getByRole("checkbox"));
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([{ id: "w2", name: "Returns" }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("discards the selection on cancel", () => {
    const { onSubmit, onClose } = renderDialog();

    fireEvent.click(within(byTestId<HTMLElement>("Returns")).getByRole("checkbox"));
    fireEvent.click(byTestId("back"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
