import { describe, expect, it } from "vitest";

import { editorJsToPlainText, plainTextToEditorJs } from "./description";

describe("category description as plain text", () => {
  it("reads paragraph blocks as paragraphs, dropping HTML tags", () => {
    expect(
      editorJsToPlainText({
        blocks: [
          { type: "paragraph", data: { text: "Warm <b>boots</b>" } },
          { type: "header", data: { text: "Sizes", level: 2 } },
          { type: "paragraph", data: { text: "line<br>break" } },
        ],
      }),
    ).toBe("Warm boots\n\nSizes\n\nline\nbreak");
  });

  it("reads the API's JSONString (a JSON document inside a string)", () => {
    expect(
      editorJsToPlainText(
        JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Hi" } }] }),
      ),
    ).toBe("Hi");
    expect(editorJsToPlainText("not json")).toBe("");
  });

  it("reads nothing from null or malformed data", () => {
    expect(editorJsToPlainText(null)).toBe("");
    expect(editorJsToPlainText({ blocks: "x" })).toBe("");
  });

  it("writes one paragraph block per paragraph, or null when blank", () => {
    expect(plainTextToEditorJs("  First\nstill first\n\n  Second  ")).toEqual({
      blocks: [
        { type: "paragraph", data: { text: "First\nstill first" } },
        { type: "paragraph", data: { text: "Second" } },
      ],
    });
    expect(plainTextToEditorJs(" \n\n ")).toBeNull();
  });

  it("round-trips what it writes", () => {
    const text = "One\n\nTwo";
    expect(editorJsToPlainText(plainTextToEditorJs(text))).toBe(text);
  });
});
