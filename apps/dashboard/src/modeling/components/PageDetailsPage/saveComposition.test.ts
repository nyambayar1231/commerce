import { describe, expect, it } from "vitest";

import { buildPageSaveComposition, hasPageSaveComposition } from "./saveComposition";

describe("buildPageSaveComposition", () => {
  it("returns general when the content is dirty", () => {
    const composition = buildPageSaveComposition([], true);

    expect(composition.hasGeneral).toBe(true);
    expect(composition.hasAvailability).toBe(false);
    expect(hasPageSaveComposition(composition)).toBe(true);
  });

  it("returns general when the title changes", () => {
    const composition = buildPageSaveComposition(["title"], false);

    expect(composition.hasGeneral).toBe(true);
    expect(composition.hasAvailability).toBe(false);
  });

  it("returns availability when the publish flag changes", () => {
    const composition = buildPageSaveComposition(["isPublished"], false);

    expect(composition.hasGeneral).toBe(false);
    expect(composition.hasAvailability).toBe(true);
    expect(hasPageSaveComposition(composition)).toBe(true);
  });

  it("is empty when nothing changed", () => {
    const composition = buildPageSaveComposition([], false);

    expect(composition.hasGeneral).toBe(false);
    expect(composition.hasAvailability).toBe(false);
    expect(hasPageSaveComposition(composition)).toBe(false);
  });
});
