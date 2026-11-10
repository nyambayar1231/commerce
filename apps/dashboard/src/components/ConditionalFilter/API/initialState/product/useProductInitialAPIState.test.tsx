// Adapted from saleor-dashboard: src/components/ConditionalFilter/API/initialState/product/useProductInitialAPIState.test.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Trimmed to the category lookup: Saleor's reference-attribute cases are dropped with attributes.
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { _SearchCategoriesOperandsDocument } from "../../../../../graphql/types.generated";
import { LocaleProvider } from "../../../../Locale/Locale";
import { useProductInitialAPIState } from "./useProductInitialAPIState";

const query = vi.fn();

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();

  return {
    ...actual,
    useApolloClient: () => ({ query }),
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <LocaleProvider>{children}</LocaleProvider>
);

beforeEach(() => {
  query.mockReset();
});

describe("useProductInitialAPIState", () => {
  it("looks the URL's category IDs up by global ID and returns their options", async () => {
    // Arrange
    query.mockResolvedValue({
      data: {
        categories: {
          edges: [
            {
              node: { id: "Q2F0ZWdvcnk6MQ==", name: "Shoes", slug: "shoes" },
            },
          ],
        },
      },
    });
    const { result } = renderHook(() => useProductInitialAPIState(), { wrapper });

    // Act
    await act(async () => {
      await result.current.fetchQueries({ category: ["Q2F0ZWdvcnk6MQ=="] });
    });

    // Assert
    expect(query).toHaveBeenCalledWith({
      query: _SearchCategoriesOperandsDocument,
      variables: { ids: ["Q2F0ZWdvcnk6MQ=="], first: 1 },
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.data.category).toEqual([
      { label: "Shoes", value: "Q2F0ZWdvcnk6MQ==", slug: "Q2F0ZWdvcnk6MQ==" },
    ]);
  });

  it("runs no query when the URL has no category filter", async () => {
    // Arrange
    const { result } = renderHook(() => useProductInitialAPIState(), { wrapper });

    // Act
    await act(async () => {
      await result.current.fetchQueries({ category: [] });
    });

    // Assert
    expect(query).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data.category).toEqual([]);
  });
});
