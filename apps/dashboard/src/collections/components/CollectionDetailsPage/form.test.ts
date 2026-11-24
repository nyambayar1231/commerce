// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

import type { CollectionDetailsFragment } from "../../../graphql/types.generated";
import { getCollectionUpdateData, useCollectionUpdateForm } from "./form";

const collection: CollectionDetailsFragment = {
  __typename: "Collection",
  id: "collection-1",
  name: "Summer",
  slug: "summer",
  description: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Warm days" } }] }),
  isPublished: false,
  publishedAt: null,
};

const renderForm = (
  onSubmit = vi.fn(async () => [] as unknown[]),
  disabled = false,
): ReturnType<typeof renderHook<ReturnType<typeof useCollectionUpdateForm>, unknown>> =>
  renderHook(() => useCollectionUpdateForm(collection, onSubmit, disabled));

const change = (result: ReturnType<typeof renderForm>, name: string, value: string): void => {
  act(() => {
    result.result.current.change({
      target: { name, value },
    } as React.ChangeEvent<HTMLInputElement>);
  });
};

describe("getCollectionUpdateData", () => {
  it("trims the name, converts the description to EditorJS and keeps the publish flag", () => {
    expect(
      getCollectionUpdateData({
        name: "  Summer sale  ",
        description: "Warm\n\nBright",
        isPublished: true,
      }),
    ).toEqual({
      name: "Summer sale",
      description: {
        blocks: [
          { type: "paragraph", data: { text: "Warm" } },
          { type: "paragraph", data: { text: "Bright" } },
        ],
      },
      isPublished: true,
    });
  });

  it("sends null for a blank description", () => {
    expect(
      getCollectionUpdateData({ name: "Summer", description: "   ", isPublished: false }),
    ).toEqual({ name: "Summer", description: null, isPublished: false });
  });
});

describe("useCollectionUpdateForm", () => {
  it("starts pristine, with Save disabled", () => {
    const { result } = renderForm();

    expect(result.current.isSaveDisabled).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.data).toEqual({
      name: "Summer",
      description: "Warm days",
      isPublished: false,
    });
  });

  it("enables Save when the name changes and reports the general segment", () => {
    const hook = renderForm();

    change(hook, "name", "Winter");

    expect(hook.result.current.data.name).toBe("Winter");
    expect(hook.result.current.isSaveDisabled).toBe(false);
    expect(hook.result.current.saveComposition.hasGeneral).toBe(true);
    expect(hook.result.current.saveComposition.hasAvailability).toBe(false);
  });

  it("enables Save when the description changes", () => {
    const hook = renderForm();

    change(hook, "description", "Cold days");

    expect(hook.result.current.isSaveDisabled).toBe(false);
    expect(hook.result.current.saveComposition.hasGeneral).toBe(true);
  });

  it("reports the availability segment when the publish flag changes back and forth", () => {
    const hook = renderForm();

    act(() => hook.result.current.changeIsPublished(true));
    expect(hook.result.current.data.isPublished).toBe(true);
    expect(hook.result.current.isSaveDisabled).toBe(false);
    expect(hook.result.current.saveComposition.hasAvailability).toBe(true);
    expect(hook.result.current.saveComposition.hasGeneral).toBe(false);

    act(() => hook.result.current.changeIsPublished(false));
    expect(hook.result.current.isSaveDisabled).toBe(true);
    expect(hook.result.current.hasUnsavedChanges).toBe(false);
  });

  it("keeps Save enabled on a blank name, so the API's error can show", async () => {
    // Unlike Saleor (and like the create dialog): the API owns the blank-name rule.
    const onSubmit = vi.fn(async () => []);
    const hook = renderForm(onSubmit);

    change(hook, "name", "   ");

    expect(hook.result.current.isSaveDisabled).toBe(false);

    await act(async () => {
      await hook.result.current.submit();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      name: "",
      description: {
        blocks: [{ type: "paragraph", data: { text: "Warm days" } }],
      },
      isPublished: false,
    });
  });

  it("submits nothing when the form is pristine", async () => {
    const onSubmit = vi.fn(async () => []);
    const { result } = renderForm(onSubmit);

    await act(async () => {
      await result.current.submit();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
