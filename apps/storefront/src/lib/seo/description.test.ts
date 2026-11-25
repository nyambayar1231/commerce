import { describe, expect, it } from "vitest";
import { descriptionOrUndefined, firstParagraphDescription } from "./description";

const doc = (...blocks: unknown[]) => JSON.stringify({ blocks });

describe("firstParagraphDescription", () => {
  it("uses the first paragraph as plain text, skipping headings", () => {
    const text = firstParagraphDescription(
      doc(
        { type: "header", data: { text: "Гарчиг", level: 2 } },
        { type: "paragraph", data: { text: "Дулаан <b>ноолуур</b> &amp; ноос." } },
        { type: "paragraph", data: { text: "Хоёр дахь." } },
      ),
    );
    expect(text).toBe("Дулаан ноолуур & ноос.");
  });

  it("cuts at 160 characters on a word boundary with an ellipsis", () => {
    const text = firstParagraphDescription(
      doc({ type: "paragraph", data: { text: "дулаан ".repeat(60) } }),
    );
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text.endsWith("дулаан…")).toBe(true);
  });

  it("is empty without a paragraph or document", () => {
    expect(firstParagraphDescription(null)).toBe("");
    expect(firstParagraphDescription(doc({ type: "header", data: { text: "x", level: 2 } }))).toBe(
      "",
    );
  });
});

describe("descriptionOrUndefined", () => {
  it("omits an empty description", () => {
    expect(descriptionOrUndefined("")).toBeUndefined();
    expect(descriptionOrUndefined("a")).toBe("a");
  });
});
