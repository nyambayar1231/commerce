import { describe, expect, it, vi } from "vitest";
import type { PageBySlugQuery } from "@/gql/graphql";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/api", () => ({
  cachedQuery: vi.fn(),
  tags: { page: (slug: string) => `page:${slug}` },
}));

const { toPageView } = await import("./pages");

// The page view (ARCHITECTURE §10.13): the API's EditorJS JSON becomes sanitized blocks plus a
// plain-text description; `parseRichText`/`richTextToPlainText` themselves have their own tests.

type RawPage = NonNullable<PageBySlugQuery["page"]>;

function page(overrides: Partial<RawPage> = {}): RawPage {
  return {
    title: "Түгээлтийн нөхцөл",
    slug: "terms",
    content: JSON.stringify({
      blocks: [
        { type: "paragraph", data: { text: "Эдгээр нөхцөл нь <b>бүх захиалгад</b> хэрэглэнэ." } },
        { type: "header", data: { text: "Нэгдүгээр хэсэг", level: 2 } },
      ],
    }),
    ...overrides,
  };
}

describe("toPageView", () => {
  it("maps the title, the sanitized blocks and the description text", () => {
    const view = toPageView(page());
    expect(view.title).toBe("Түгээлтийн нөхцөл");
    expect(view.content).toEqual([
      { type: "paragraph", html: "Эдгээр нөхцөл нь <b>бүх захиалгад</b> хэрэглэнэ." },
      { type: "heading", level: 2, html: "Нэгдүгээр хэсэг" },
    ]);
    expect(view.descriptionText).toBe("Эдгээр нөхцөл нь бүх захиалгад хэрэглэнэ. Нэгдүгээр хэсэг");
  });

  it("renders an empty page without errors", () => {
    const view = toPageView(page({ content: null }));
    expect(view.content).toEqual([]);
    expect(view.descriptionText).toBe("");
  });
});
