// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/initialState/product/InitalProductStateResponse.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Trimmed to the category lookup (Saleor's test file is named `Inital…`); our URL holds global IDs,
// so the match is on the option's value instead of its slug.
import { describe, expect, it } from "vitest";

import { UrlToken } from "../../../ValueProvider/UrlToken";
import { InitialProductStateResponse } from "./InitialProductStateResponse";

const shoes = { label: "Shoes", value: "Q2F0ZWdvcnk6MQ==", slug: "Q2F0ZWdvcnk6MQ==" };
const boots = { label: "Boots", value: "Q2F0ZWdvcnk6Mg==", slug: "Q2F0ZWdvcnk6Mg==" };

const response = new InitialProductStateResponse([shoes, boots]);

describe("InitialProductStateResponse", () => {
  it("returns the loaded options a token names, in the loaded order", () => {
    const token = new UrlToken("category", ["Q2F0ZWdvcnk6Mg==", "Q2F0ZWdvcnk6MQ=="], "s", "in");

    expect(response.filterByUrlToken(token)).toEqual([shoes, boots]);
  });

  it("returns a single option for an `is` token", () => {
    const token = new UrlToken("category", "Q2F0ZWdvcnk6MQ==", "s", "is");

    expect(response.filterByUrlToken(token)).toEqual([shoes]);
  });

  it("ignores a value the lookup does not know", () => {
    const token = new UrlToken("category", "Q2F0ZWdvcnk6Mw==", "s", "is");

    expect(response.filterByUrlToken(token)).toEqual([]);
  });
});
