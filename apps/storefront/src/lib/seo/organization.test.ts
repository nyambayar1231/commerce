import { describe, expect, it } from "vitest";
import { buildOrganizationJsonLd } from "./organization";

describe("buildOrganizationJsonLd", () => {
  it("names the shop and its origin", () => {
    expect(buildOrganizationJsonLd("Дэлгүүр", "https://shop.example")).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Дэлгүүр",
      url: "https://shop.example",
    });
  });
});
