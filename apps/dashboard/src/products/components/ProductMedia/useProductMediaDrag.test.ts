// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProductMediaFragment } from "../../../graphql/types.generated";
import { getReorderedMediaIds, useProductMediaDrag } from "./useProductMediaDrag";

const media: ProductMediaFragment[] = ["a", "b", "c"].map((id, sortOrder) => ({
  __typename: "ProductMedia",
  id,
  alt: "",
  sortOrder,
  type: "IMAGE",
  url: `https://example.com/${id}.png`,
  oembedData: {},
}));

describe("getReorderedMediaIds", () => {
  it("maps the moved indices to ids in the new order", () => {
    expect(getReorderedMediaIds(["a", "b", "c"], { oldIndex: 0, newIndex: 2 })).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(getReorderedMediaIds(["a", "b", "c"], { oldIndex: 2, newIndex: 0 })).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("returns null when the indices do not describe a move", () => {
    expect(getReorderedMediaIds(["a", "b"], { oldIndex: 1, newIndex: 1 })).toBeNull();
    expect(getReorderedMediaIds(["a", "b"], { oldIndex: -1, newIndex: 0 })).toBeNull();
    expect(getReorderedMediaIds(["a", "b"], { oldIndex: 0, newIndex: 2 })).toBeNull();
  });
});

describe("useProductMediaDrag", () => {
  it("reorders locally on drag over and commits indices on drag end", () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useProductMediaDrag({ media, onReorder }));

    act(() => {
      result.current.handleDragStart({ active: { id: "a" } } as never);
    });
    act(() => {
      result.current.handleDragOver({ active: { id: "a" }, over: { id: "c" } } as never);
    });

    expect(result.current.orderedMedia.map((item) => item.id)).toEqual(["b", "c", "a"]);

    act(() => {
      result.current.handleDragEnd({} as never);
    });

    expect(onReorder).toHaveBeenCalledWith({ oldIndex: 0, newIndex: 2 });
    expect(result.current.activeId).toBeNull();
  });

  it("restores the prop order on drag cancel", () => {
    const { result } = renderHook(() => useProductMediaDrag({ media }));

    act(() => {
      result.current.handleDragStart({ active: { id: "a" } } as never);
    });
    act(() => {
      result.current.handleDragOver({ active: { id: "a" }, over: { id: "b" } } as never);
    });

    act(() => {
      result.current.handleDragCancel();
    });

    expect(result.current.orderedMedia.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.current.activeId).toBeNull();
  });

  it("does not commit when the media changed during the drag", () => {
    const onReorder = vi.fn();
    const { result, rerender } = renderHook(
      ({ media: nextMedia }) => useProductMediaDrag({ media: nextMedia, onReorder }),
      { initialProps: { media } },
    );

    act(() => {
      result.current.handleDragStart({ active: { id: "a" } } as never);
    });
    act(() => {
      result.current.handleDragOver({ active: { id: "a" }, over: { id: "c" } } as never);
    });

    rerender({
      media: [
        ...media,
        {
          __typename: "ProductMedia",
          id: "d",
          alt: "",
          sortOrder: 3,
          type: "IMAGE",
          url: "https://example.com/d.png",
          oembedData: {},
        },
      ],
    });

    act(() => {
      result.current.handleDragEnd({} as never);
    });

    expect(onReorder).not.toHaveBeenCalled();
    expect(result.current.orderedMedia.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("commits indices relative to the live media list", () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useProductMediaDrag({ media, onReorder }));

    act(() => {
      result.current.handleDragStart({ active: { id: "c" } } as never);
    });
    act(() => {
      result.current.handleDragOver({ active: { id: "c" }, over: { id: "a" } } as never);
    });

    act(() => {
      result.current.handleDragEnd({} as never);
    });

    expect(onReorder).toHaveBeenCalledWith({ oldIndex: 2, newIndex: 0 });
  });

  it("ignores drags while disabled", () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useProductMediaDrag({ media, onReorder, disabled: true }));

    act(() => {
      result.current.handleDragStart({ active: { id: "a" } } as never);
    });

    expect(result.current.activeId).toBeNull();
  });
});
