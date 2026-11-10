// Adapted from saleor-dashboard: src/components/ConditionalFilter/useContainerState.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Trimmed to our synchronous, constraint-free URL provider.
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Condition } from "./FilterElement/Condition";
import { ConditionOptions } from "./FilterElement/ConditionOptions";
import { ConditionSelected } from "./FilterElement/ConditionSelected";
import { ExpressionValue, FilterElement } from "./FilterElement/FilterElement";
import type { FilterValueProvider } from "./FilterValueProvider";
import { useContainerState } from "./useContainerState";

const provider = (value: FilterElement[] = []): FilterValueProvider => ({
  loading: false,
  value,
  persist: () => undefined,
  clear: () => undefined,
  count: value.length,
});

const priceElement = (value: string = "123"): FilterElement =>
  new FilterElement(
    new ExpressionValue("price", "Price", "price"),
    new Condition(
      ConditionOptions.fromStaticElementName("price"),
      new ConditionSelected(value, { type: "number", label: "is", value: "input-1" }, []),
    ),
  );

describe("ConditionalFilter / useContainerState", () => {
  it("sets the initial value from the provider", () => {
    const { result } = renderHook(() => useContainerState(provider()));

    expect(result.current.value).toEqual([]);
  });

  it("initializes from a non-empty provider", () => {
    const element = priceElement();
    const { result } = renderHook(() => useContainerState(provider([element])));

    expect(result.current.value).toEqual([element]);
  });

  it("resets editable rows back to the provider value", () => {
    const element = priceElement();
    const { result } = renderHook(() => useContainerState(provider([element])));

    act(() => {
      result.current.createEmpty();
    });
    expect(result.current.value).toHaveLength(3);

    act(() => {
      result.current.resetToProvider();
    });

    expect(result.current.value).toEqual([element]);
  });

  it("does not share mutations with the provider on reset", () => {
    const element = priceElement();
    const { result } = renderHook(() => useContainerState(provider([element])));

    act(() => {
      result.current.updateAt("0", (el) => el.updateRightOperator("999"));
    });
    act(() => {
      result.current.resetToProvider();
    });

    expect(element.condition.selected.value).toBe("123");
    expect((result.current.value[0] as FilterElement).condition.selected.value).toBe("123");
  });

  it("seeds an empty row when resetToProvider has nothing applied", () => {
    const { result } = renderHook(() => useContainerState(provider()));

    act(() => {
      result.current.resetToProvider({ seedEmpty: true });
    });

    expect(result.current.value).toEqual([FilterElement.createEmpty()]);
  });

  it("creates a new empty row", () => {
    const { result } = renderHook(() => useContainerState(provider()));

    act(() => {
      result.current.createEmpty();
    });

    expect(result.current.value).toEqual([FilterElement.createEmpty()]);
  });

  it("separates rows with AND", () => {
    const element = priceElement();
    const { result } = renderHook(() => useContainerState(provider()));

    act(() => {
      result.current.createEmpty();
    });
    act(() => {
      result.current.create(element);
    });

    expect(result.current.value).toEqual([FilterElement.createEmpty(), "AND", element]);
  });

  it("removes a row together with its separator", () => {
    const element = priceElement();
    const { result } = renderHook(() => useContainerState(provider()));

    act(() => {
      result.current.createEmpty();
    });
    act(() => {
      result.current.create(element);
    });
    act(() => {
      result.current.removeAt("0");
    });

    expect(result.current.value).toEqual([element]);
  });

  it("clears empty rows", () => {
    const element = priceElement();
    const { result } = renderHook(() => useContainerState(provider()));

    act(() => {
      result.current.createEmpty();
    });
    act(() => {
      result.current.create(element);
    });
    act(() => {
      result.current.clearEmpty();
    });

    expect(result.current.value).toEqual([element]);
  });

  it("keeps a filled unsaved row when adding another condition", () => {
    const element = priceElement();
    const { result } = renderHook(() => useContainerState(provider()));

    act(() => {
      result.current.create(element);
    });
    act(() => {
      result.current.createAndRemoveEmpty(FilterElement.createEmpty());
    });

    expect(result.current.value).toEqual([element, "AND", FilterElement.createEmpty()]);
  });
});
