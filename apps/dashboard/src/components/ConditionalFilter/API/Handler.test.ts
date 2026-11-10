// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/Handler.test.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Trimmed to the category handler: Saleor's warehouse/attribute/collection cases are dropped with
// those handlers.
import type { ApolloClient } from "@apollo/client";
import { describe, expect, it, vi } from "vitest";

import { _GetCategoriesChoicesDocument } from "../../../graphql/types.generated";
import { FILTER_CHOICES_PAGE_SIZE } from "./filterChoicesPage";
import { CategoryHandler } from "./Handler";

const categoriesResponse = {
  data: {
    categories: {
      __typename: "CategoryCountableConnection",
      pageInfo: { __typename: "PageInfo", hasNextPage: true, endCursor: "cursor-2" },
      edges: [
        {
          __typename: "CategoryCountableEdge",
          node: {
            __typename: "Category",
            id: "Q2F0ZWdvcnk6MQ==",
            name: "Shoes",
            slug: "shoes",
          },
        },
        {
          __typename: "CategoryCountableEdge",
          node: {
            __typename: "Category",
            id: "Q2F0ZWdvcnk6Mg==",
            name: null,
            slug: "unnamed",
          },
        },
      ],
    },
  },
};

describe("CategoryHandler", () => {
  it("fetches one page with the typed search and maps it to options", async () => {
    // Arrange
    const query = vi.fn().mockResolvedValue(categoriesResponse);
    const handler = new CategoryHandler({ query } as unknown as ApolloClient<unknown>, "shoe");

    // Act
    const options = await handler.fetch();

    // Assert
    expect(query).toHaveBeenCalledWith({
      query: _GetCategoriesChoicesDocument,
      variables: {
        first: FILTER_CHOICES_PAGE_SIZE,
        after: undefined,
        query: "shoe",
      },
    });
    // Our URL holds global IDs, so an option's `slug` (the URL value) is its ID.
    expect(options).toEqual([
      { label: "Shoes", value: "Q2F0ZWdvcnk6MQ==", slug: "Q2F0ZWdvcnk6MQ==" },
      { label: "", value: "Q2F0ZWdvcnk6Mg==", slug: "Q2F0ZWdvcnk6Mg==" },
    ]);
    expect(handler.pageInfo).toEqual({ hasNextPage: true, endCursor: "cursor-2" });
  });

  it("passes the cursor of the next page", async () => {
    // Arrange
    const query = vi.fn().mockResolvedValue(categoriesResponse);
    const handler = new CategoryHandler({ query } as unknown as ApolloClient<unknown>, "");

    // Act
    await handler.fetch("cursor-2");

    // Assert
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ after: "cursor-2" }),
      }),
    );
  });
});
