// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";

import type { PageDetailsFragment } from "../../../graphql/types.generated";
import { getPageSubmitData, usePageForm } from "./form";

const page: PageDetailsFragment = {
  __typename: "Page",
  id: "page-1",
  title: "About us",
  slug: "about-us",
  content: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Hello there" } }] }),
  isPublished: false,
  publishedAt: null,
};

const renderForm = (
  onSubmit = vi.fn(async () => [] as unknown[]),
  disabled = false,
): ReturnType<typeof renderHook<ReturnType<typeof usePageForm>, unknown>> =>
  renderHook(() => usePageForm(page, onSubmit, disabled));

const renderCreateForm = (
  onSubmit = vi.fn(async () => [] as unknown[]),
): ReturnType<typeof renderHook<ReturnType<typeof usePageForm>, unknown>> =>
  renderHook(() => usePageForm(null, onSubmit, false));

const change = (result: ReturnType<typeof renderForm>, name: string, value: string): void => {
  act(() => {
    result.result.current.change({
      target: { name, value },
    } as React.ChangeEvent<HTMLInputElement>);
  });
};

describe("getPageSubmitData", () => {
  it("trims the title, converts the content to EditorJS and keeps the publish flag", () => {
    expect(
      getPageSubmitData({
        title: "  About us  ",
        content: "Hello\n\nWorld",
        isPublished: true,
      }),
    ).toEqual({
      title: "About us",
      content: {
        blocks: [
          { type: "paragraph", data: { text: "Hello" } },
          { type: "paragraph", data: { text: "World" } },
        ],
      },
      isPublished: true,
    });
  });

  it("sends null for blank content", () => {
    expect(getPageSubmitData({ title: "About us", content: "   ", isPublished: false })).toEqual({
      title: "About us",
      content: null,
      isPublished: false,
    });
  });
});

describe("usePageForm", () => {
  it("starts pristine, with Save disabled", () => {
    const { result } = renderForm();

    expect(result.current.isSaveDisabled).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.data).toEqual({
      title: "About us",
      content: "Hello there",
      isPublished: false,
    });
  });

  it("starts an empty, published page for Create (Saleor's PageCreate)", () => {
    const { result } = renderCreateForm();

    expect(result.current.data).toEqual({ title: "", content: "", isPublished: true });
    expect(result.current.isSaveDisabled).toBe(true);
  });

  it("enables Save when the title changes and reports the general segment", () => {
    const hook = renderForm();

    change(hook, "title", "Contact");

    expect(hook.result.current.data.title).toBe("Contact");
    expect(hook.result.current.isSaveDisabled).toBe(false);
    expect(hook.result.current.saveComposition.hasGeneral).toBe(true);
    expect(hook.result.current.saveComposition.hasAvailability).toBe(false);
  });

  it("enables Save when the content changes", () => {
    const hook = renderForm();

    change(hook, "content", "New content");

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

  it("keeps Save enabled on a blank title, so the API's error can show", async () => {
    // Unlike Saleor (and like the collection page): the API owns the blank-title rule.
    const onSubmit = vi.fn(async () => []);
    const hook = renderForm(onSubmit);

    change(hook, "title", "   ");

    expect(hook.result.current.isSaveDisabled).toBe(false);

    await act(async () => {
      await hook.result.current.submit();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      title: "",
      content: {
        blocks: [{ type: "paragraph", data: { text: "Hello there" } }],
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
