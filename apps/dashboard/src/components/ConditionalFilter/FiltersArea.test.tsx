// Adapted from saleor-dashboard: src/components/ConditionalFilter/FiltersArea.test.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../Locale/Locale";
import { useConditionalFilterContext } from "./context/consumer";
import { Condition } from "./FilterElement/Condition";
import { ConditionOptions } from "./FilterElement/ConditionOptions";
import { ConditionSelected } from "./FilterElement/ConditionSelected";
import {
  ExpressionValue,
  type FilterContainer,
  FilterElement,
} from "./FilterElement/FilterElement";
import { FiltersArea } from "./FiltersArea";
import { useFilterContainer } from "./useFilterContainer";

vi.mock("./context/consumer", () => ({
  useConditionalFilterContext: vi.fn(),
}));
vi.mock("./useFilterContainer", () => ({
  useFilterContainer: vi.fn(),
}));
vi.mock("./useFilteredOperands", () => ({
  useFilteredOperands: (): unknown[] => [],
}));
vi.mock("./UI", () => {
  const Footer = ({ children }: { children: ReactNode }): React.ReactNode => <div>{children}</div>;
  const Button = ({
    children,
    ...props
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    "data-test-id"?: string;
  }): React.ReactNode => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const Filters = Object.assign(
    ({ children }: { children: ReactNode }): React.ReactNode => <div>{children}</div>,
    {
      Footer,
      AddRowButton: Button,
      ClearButton: Button,
      CloseButton: Button,
      ConfirmButton: Button,
    },
  );

  return { Filters };
});

const mockUseConditionalFilterContext = vi.mocked(useConditionalFilterContext);

const byTestId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`[data-test-id="${id}"]`);

  if (!element) throw new Error(`no element with data-test-id="${id}"`);

  return element;
};
const mockUseFilterContainer = vi.mocked(useFilterContainer);

const priceElement = (): FilterElement =>
  new FilterElement(
    new ExpressionValue("price", "Price", "price"),
    new Condition(
      ConditionOptions.fromStaticElementName("price"),
      new ConditionSelected(
        ["100", "200"],
        { type: "number.range", label: "between", value: "input-4" },
        [],
      ),
    ),
  );

const renderArea = ({
  value = [],
  hasEmptyRows = false,
  onConfirm = vi.fn<(value: FilterContainer) => boolean | undefined>(),
}: {
  value?: FilterElement[];
  hasEmptyRows?: boolean;
  onConfirm?: (value: FilterContainer) => boolean | undefined;
} = {}) => {
  const addEmpty = vi.fn();
  const removeAt = vi.fn();

  mockUseConditionalFilterContext.mockReturnValue({
    valueProvider: { value: [], count: 0, loading: false, persist: vi.fn(), clear: vi.fn() },
    leftOperandsProvider: { operands: [] },
    containerState: {} as never,
    filterWindow: { isOpen: true, setOpen: vi.fn() },
  });
  mockUseFilterContainer.mockReturnValue({
    value,
    hasEmptyRows,
    addEmpty,
    removeAt,
    updateLeftOperator: vi.fn(),
    updateRightOperator: vi.fn(),
    updateCondition: vi.fn(),
  });

  render(
    <LocaleProvider>
      <FiltersArea layout="panel" onConfirm={onConfirm} onClear={vi.fn()} onCancel={vi.fn()} />
    </LocaleProvider>,
  );

  return { addEmpty, onConfirm };
};

afterEach(cleanup);

describe("FiltersArea", () => {
  it("shows the panel's Clear, Close and Apply buttons", () => {
    renderArea();

    expect(byTestId("reset-all-filters-button").textContent).toBe("Clear filters");
    expect(byTestId("close-filters-button").textContent).toBe("Close");
    expect(byTestId("save-filters-button").textContent).toBe("Apply");
  });

  it("disables Apply while nothing changed", () => {
    renderArea();

    expect((byTestId("save-filters-button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("applies a changed, valid container", () => {
    const value = [priceElement()];
    const persist = vi.fn<(value: FilterContainer) => boolean | undefined>();

    renderArea({ value, onConfirm: persist });
    fireEvent.click(byTestId("save-filters-button"));

    expect(persist).toHaveBeenCalledWith(value);
  });
});
