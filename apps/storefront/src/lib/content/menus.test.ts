import { describe, expect, it, vi } from "vitest";
import type { MenuBySlugQuery } from "@/gql/graphql";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/api", () => ({
  cachedQuery: vi.fn(),
  tags: { menu: (slug: string) => `menu:${slug}` },
}));

const { toMenuItems } = await import("./menus");

// The menu mapping (ARCHITECTURE §10.3) with fixtures: the owner's menus are real data, never
// test data. Category/collection/page targets, external and relative URLs, unsafe URLs that are
// dropped, and the three-level tree.

type RawItem = NonNullable<NonNullable<MenuBySlugQuery["menu"]>["items"]>[number];

function item(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "TWVudUl0ZW06MQ",
    name: "Ангилалууд",
    url: null,
    category: null,
    collection: null,
    page: null,
    children: [],
    ...overrides,
  };
}

describe("toMenuItems", () => {
  it("links a category, a collection and a page item to their storefront routes", () => {
    const items = toMenuItems([
      item({ id: "i1", name: "Ангилал", category: { slug: "goo-saihan" } }),
      item({ id: "i2", name: "Коллекц", collection: { slug: "shine" } }),
      item({ id: "i3", name: "Тухай", page: { slug: "about" } }),
    ]);
    expect(items.map(({ href, external }) => ({ href, external }))).toEqual([
      { href: "/categories/goo-saihan", external: false },
      { href: "/collections/shine", external: false },
      { href: "/pages/about", external: false },
    ]);
  });

  it("keeps an external http(s) url and marks it external", () => {
    const items = toMenuItems([
      item({ id: "i1", name: "Facebook", url: "https://example.com/shop" }),
      item({ id: "i2", name: "Local", url: "http://localhost:3000/x" }),
    ]);
    expect(items.map(({ href, external }) => ({ href, external }))).toEqual([
      { href: "https://example.com/shop", external: true },
      { href: "http://localhost:3000/x", external: true },
    ]);
  });

  it("keeps a safe relative url as a same-site path", () => {
    const items = toMenuItems([
      item({ id: "i1", name: "Хуудас", url: "/pages/about?from=menu" }),
      item({ id: "i2", name: "Root", url: "/" }),
    ]);
    expect(items.map((i) => i.href)).toEqual(["/pages/about?from=menu", "/"]);
  });

  it("drops items with no usable target (no target, unpublished target, unsafe url)", () => {
    const items = toMenuItems([
      item({ id: "i1", name: "Хоосон" }),
      item({ id: "i2", name: "Нууц", category: null, url: null }),
      item({ id: "i3", name: "Protocol-relative", url: "//evil.example/" }),
      item({ id: "i4", name: "Backslash", url: "/\\evil.example/" }),
      item({ id: "i5", name: "Encoded slash", url: "/pages/%2f%2fevil.example/" }),
      item({ id: "i6", name: "Control", url: "/pages/\u0000" }),
      item({ id: "i7", name: "Scheme", url: "javascript:alert(1)" }),
      item({ id: "i8", name: "Mailto", url: "mailto:shop@example.com" }),
      item({ id: "i9", name: "Nested path", url: "/pages/../admin" }),
    ]);
    // "/pages/../admin" normalizes to a same-origin relative path, so it stays a safe path.
    expect(items.map((i) => i.name)).toEqual(["Nested path"]);
    expect(items[0]?.href).toBe("/admin");
  });

  it("maps a three-level tree and drops an unsafe item with its subtree", () => {
    const tree = toMenuItems([
      item({
        id: "top",
        name: "Ангилалууд",
        url: "/products",
        children: [
          item({
            id: "mid",
            name: "Гоо сайхан",
            category: { slug: "goo-saihan" },
            children: [
              item({ id: "leaf", name: "Арван нэг", category: { slug: "nogoo" } }),
              item({ id: "bad-leaf", name: "Муу", url: "//evil.example/" }),
            ],
          }),
          item({
            id: "bad-mid",
            name: "Муу дунд",
            url: "javascript:alert(1)",
            children: [item({ id: "gone", name: "Алга", category: { slug: "x" } })],
          }),
        ],
      }),
    ]);
    expect(tree).toEqual([
      {
        id: "top",
        name: "Ангилалууд",
        href: "/products",
        external: false,
        children: [
          {
            id: "mid",
            name: "Гоо сайхан",
            href: "/categories/goo-saihan",
            external: false,
            children: [
              {
                id: "leaf",
                name: "Арван нэг",
                href: "/categories/nogoo",
                external: false,
                children: [],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("keeps an item whose target is a category over its url field", () => {
    const items = toMenuItems([
      item({ id: "i1", name: "Ангилал", category: { slug: "cat" }, url: "/products" }),
    ]);
    expect(items[0]?.href).toBe("/categories/cat");
  });
});
