import { describe, expect, it } from "vitest";

import type { MenuItemFragment } from "../../../graphql/types.generated";
import type { LinkTypeLabels } from "./options";
import { getItemLink, getLinkOptions, getMenuItemInputData, isUrlLike } from "./options";

const labels: LinkTypeLabels = {
  category: "Category",
  collection: "Collection",
  page: "Page",
  url: "Link to",
};

const emptyItem: MenuItemFragment = {
  __typename: "MenuItem",
  id: "item",
  name: "Item",
  level: 0,
  url: null,
  category: null,
  collection: null,
  page: null,
};

describe("menu item dialog link choice", () => {
  it("treats http(s) URLs and storefront paths as URLs", () => {
    expect(isUrlLike("https://example.com/sale")).toBe(true);
    expect(isUrlLike("/collections")).toBe(true);
    expect(isUrlLike("example.com")).toBe(false);
    expect(isUrlLike("about us")).toBe(false);
  });

  it("offers categories, collections and pages with their ids", () => {
    const options = getLinkOptions(
      {
        categories: [{ id: "cat-1", name: "Shoes" }],
        collections: [{ id: "col-1", name: "Summer" }],
        pages: [{ id: "page-1", title: "About" }],
      },
      "",
      labels,
    );

    expect(options).toEqual([
      {
        value: "category:cat-1",
        label: "Category: Shoes",
        linkType: "category",
        linkValue: "cat-1",
      },
      {
        value: "collection:col-1",
        label: "Collection: Summer",
        linkType: "collection",
        linkValue: "col-1",
      },
      { value: "page:page-1", label: "Page: About", linkType: "page", linkValue: "page-1" },
    ]);
  });

  it("puts the typed URL first when the text looks like one", () => {
    const options = getLinkOptions(
      { categories: [{ id: "cat-1", name: "Shoes" }], collections: [], pages: [] },
      "  /sale ",
      labels,
    );

    expect(options[0]).toEqual({
      value: "url:/sale",
      label: "Link to: /sale",
      linkType: "url",
      linkValue: "/sale",
    });
  });

  it("finds the link an existing item points at", () => {
    expect(getItemLink({ ...emptyItem, url: "/sale" })).toEqual({
      type: "url",
      value: "/sale",
      display: "/sale",
    });
    expect(
      getItemLink({
        ...emptyItem,
        page: { __typename: "Page", id: "page-1", title: "About" },
      }),
    ).toMatchObject({ type: "page", value: "page-1" });
    expect(getItemLink(emptyItem)).toBeNull();
  });

  it("maps the chosen link to the mutation's input field", () => {
    expect(
      getMenuItemInputData({
        name: "Shoes",
        link: { type: "category", value: "cat-1", display: "Shoes" },
      }),
    ).toEqual({ name: "Shoes", category: "cat-1" });
    expect(
      getMenuItemInputData({
        name: "Summer",
        link: { type: "collection", value: "col-1", display: "Summer" },
      }),
    ).toEqual({ name: "Summer", collection: "col-1" });
    expect(
      getMenuItemInputData({
        name: "Sale",
        link: { type: "url", value: "/sale", display: "/sale" },
      }),
    ).toEqual({ name: "Sale", url: "/sale" });
  });
});
