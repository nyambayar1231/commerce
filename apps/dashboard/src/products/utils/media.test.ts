import { describe, expect, it } from "vitest";

import { areMediaSelectionsEqual, getMediaDiff, getSelectedMedia } from "./media";

const image = (id: string, sortOrder: number | null) => ({ id, sortOrder });

describe("getSelectedMedia", () => {
  it("keeps only the chosen images, in the product's media order", () => {
    const media = [image("media-1", 0), image("media-2", 1), image("media-3", 2)];

    expect(getSelectedMedia(media, ["media-3", "media-1"])).toEqual([
      image("media-1", 0),
      image("media-3", 2),
    ]);
  });

  it("returns nothing when no media is chosen", () => {
    expect(getSelectedMedia([image("media-1", 0)], [])).toEqual([]);
    expect(getSelectedMedia(undefined, ["media-1"])).toEqual([]);
  });
});

describe("areMediaSelectionsEqual", () => {
  it("ignores the order but not the ids", () => {
    expect(areMediaSelectionsEqual(["a", "b"], ["b", "a"])).toBe(true);
    expect(areMediaSelectionsEqual(["a"], ["a", "b"])).toBe(false);
    expect(areMediaSelectionsEqual(["a", "c"], ["a", "b"])).toBe(false);
    expect(areMediaSelectionsEqual(undefined, [])).toBe(true);
  });
});

describe("getMediaDiff", () => {
  it("splits the selection into the ids to assign and the ids to unassign", () => {
    expect(getMediaDiff(["media-1", "media-2"], ["media-2", "media-3"])).toEqual({
      added: ["media-3"],
      removed: ["media-1"],
    });
  });

  it("has nothing to do when the selection did not change", () => {
    expect(getMediaDiff(["media-1", "media-2"], ["media-2", "media-1"])).toEqual({
      added: [],
      removed: [],
    });
  });

  it("assigns every id of an initially empty selection and removes them all when cleared", () => {
    expect(getMediaDiff([], ["media-1", "media-2"])).toEqual({
      added: ["media-1", "media-2"],
      removed: [],
    });
    expect(getMediaDiff(["media-1", "media-2"], [])).toEqual({
      added: [],
      removed: ["media-1", "media-2"],
    });
  });
});
