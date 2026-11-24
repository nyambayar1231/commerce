import { describe, expect, it } from "vitest";

import { buildCollectionSaveComposition, hasCollectionSaveComposition } from "./saveComposition";

describe("buildCollectionSaveComposition", () => {
  it("returns general when the description is dirty", () => {
    const composition = buildCollectionSaveComposition([], true);

    expect(composition.hasGeneral).toBe(true);
    expect(composition.hasAvailability).toBe(false);
    expect(hasCollectionSaveComposition(composition)).toBe(true);
  });

  it("returns general when the name changes", () => {
    const composition = buildCollectionSaveComposition(["name"], false);

    expect(composition.hasGeneral).toBe(true);
    expect(composition.hasAvailability).toBe(false);
  });

  it("returns availability when the publish flag changes", () => {
    const composition = buildCollectionSaveComposition(["isPublished"], false);

    expect(composition.hasGeneral).toBe(false);
    expect(composition.hasAvailability).toBe(true);
    expect(hasCollectionSaveComposition(composition)).toBe(true);
  });

  it("is empty when nothing changed", () => {
    const composition = buildCollectionSaveComposition([], false);

    expect(composition.hasGeneral).toBe(false);
    expect(composition.hasAvailability).toBe(false);
    expect(hasCollectionSaveComposition(composition)).toBe(false);
  });
});
