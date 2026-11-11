// @vitest-environment jsdom
import { MockedProvider } from "@apollo/client/testing";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { LocaleProvider } from "../../../components/Locale/Locale";
import { CategoryProductsDocument } from "../../../graphql/types.generated";
import { ThemeProvider } from "../../../theme/provider";
import { CategoryProducts } from "./CategoryProducts";

afterEach(cleanup);

const productsMock = (thumbnail: { url: string } | null) => ({
  request: {
    query: CategoryProductsDocument,
    variables: {
      id: "cat-1",
      first: 20,
      after: undefined,
      last: undefined,
      before: undefined,
    },
  },
  result: {
    data: {
      __typename: "Query",
      category: {
        __typename: "Category",
        id: "cat-1",
        products: {
          __typename: "ProductCountableConnection",
          edges: [
            {
              __typename: "ProductCountableEdge",
              node: {
                __typename: "Product",
                id: "product-1",
                name: "Shoe",
                isPublished: true,
                publishedAt: null,
                thumbnail,
              },
            },
          ],
          pageInfo: {
            __typename: "PageInfo",
            endCursor: null,
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
          },
        },
      },
    },
  },
});

const renderProducts = (thumbnail: { url: string } | null) =>
  render(
    <MockedProvider mocks={[productsMock(thumbnail)]}>
      <ThemeProvider>
        <LocaleProvider>
          <MemoryRouter>
            <CategoryProducts
              category={{ id: "cat-1", name: "Shoes" }}
              categoryId="cat-1"
              disabled={false}
            />
          </MemoryRouter>
        </LocaleProvider>
      </ThemeProvider>
    </MockedProvider>,
  );

describe("CategoryProducts", () => {
  it("shows the product's thumbnail", async () => {
    renderProducts({ url: "https://example.com/thumb.png" });

    const image = await screen.findByRole("img", { name: "Shoe" });

    expect(image.getAttribute("src")).toBe("https://example.com/thumb.png");
    expect(document.querySelector('[data-test-id="empty-image"]')).toBeNull();
  });

  it("shows the placeholder when the product has no thumbnail", async () => {
    renderProducts(null);

    await screen.findByText("Shoe");

    expect(document.querySelector('[data-test-id="empty-image"]')).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
