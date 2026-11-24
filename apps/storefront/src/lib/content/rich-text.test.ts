import { describe, expect, it } from "vitest";
import { parseRichText, richTextToPlainText, sanitizeInline } from "./rich-text";

const doc = (...blocks: unknown[]) => JSON.stringify({ blocks });

describe("sanitizeInline", () => {
  it.each([
    ["<script>alert(1)</script>ok", "ok"],
    ['<img src=x onerror="alert(1)">ok', "ok"],
    ['<b onclick="alert(1)">x</b>', "<b>x</b>"],
    ['<iframe src="https://evil"></iframe>ok', "ok"],
    ["<style>body{}</style>ok", "ok"],
    ['<svg onload="alert(1)">ok</svg>', "ok"],
    ["<div><p>text</p></div>", "text"],
  ])("removes %s", (input, expected) => {
    expect(sanitizeInline(input)).toBe(expected);
  });

  it.each([
    '<a href="javascript:alert(1)">x</a>',
    '<a href=" JaVaScRiPt:alert(1)">x</a>',
    '<a href="java&#115;cript:alert(1)">x</a>',
    '<a href="data:text/html,x">x</a>',
    '<a href="//evil.example">x</a>',
  ])("drops the unsafe href of %s", (input) => {
    const out = sanitizeInline(input);
    expect(out).not.toMatch(/javascript|data:|evil/i);
    expect(out).toMatch(/>x<\/a>$/);
  });

  it("keeps the inline allowlist", () => {
    expect(
      sanitizeInline("<b>b</b> <i>i</i> <strong>s</strong> <em>e</em> <u>u</u> <s>x</s><br>"),
    ).toBe("<b>b</b> <i>i</i> <strong>s</strong> <em>e</em> <u>u</u> <s>x</s><br>");
  });

  it("keeps http(s) and mailto links, made safe", () => {
    expect(
      sanitizeInline('<a href="https://ex.mn/a?b=1&c=2" target="_self" rel="opener">x</a>'),
    ).toBe(
      '<a rel="noopener noreferrer nofollow" target="_blank" href="https://ex.mn/a?b=1&amp;c=2">x</a>',
    );
    expect(sanitizeInline('<a href="mailto:a@b.mn">m</a>')).toContain('href="mailto:a@b.mn"');
  });

  it("keeps escaped entities as text (EditorJS stores a literal < as &lt;)", () => {
    expect(sanitizeInline("1 &lt; 2 &amp; 3")).toBe("1 &lt; 2 &amp; 3");
  });
});

describe("parseRichText", () => {
  it("maps paragraph, header, list and quote blocks", () => {
    const blocks = parseRichText(
      doc(
        { type: "paragraph", data: { text: "Hi <b>there</b>" } },
        { type: "header", data: { text: "Title", level: 1 } },
        { type: "header", data: { text: "Deep", level: 6 } },
        {
          type: "list",
          data: {
            style: "ordered",
            items: ["one", { content: "two", items: [{ content: "2a", items: [] }] }],
          },
        },
        { type: "quote", data: { text: "Said" } },
      ),
    );
    expect(blocks).toEqual([
      { type: "paragraph", html: "Hi <b>there</b>" },
      { type: "heading", level: 2, html: "Title" },
      { type: "heading", level: 4, html: "Deep" },
      { type: "list", ordered: true, items: ["one", "two", "2a"] },
      { type: "quote", html: "Said" },
    ]);
  });

  it("drops unknown, malformed and empty blocks", () => {
    expect(
      parseRichText(
        doc(
          { type: "image", data: { file: { url: "https://x" } } },
          { type: "paragraph" },
          { type: "paragraph", data: { text: "<script>x</script>" } },
          null,
          "text",
        ),
      ),
    ).toEqual([]);
  });

  it("treats null, bad JSON and a document without blocks as empty", () => {
    expect(parseRichText(null)).toEqual([]);
    expect(parseRichText("{not json")).toEqual([]);
    expect(parseRichText('{"time":1}')).toEqual([]);
  });

  it("accepts an already parsed document", () => {
    expect(parseRichText({ blocks: [{ type: "paragraph", data: { text: "x" } }] })).toHaveLength(1);
  });
});

describe("richTextToPlainText", () => {
  it("joins block text without tags and decodes entities", () => {
    expect(
      richTextToPlainText(
        doc(
          { type: "paragraph", data: { text: "A <b>b</b> &amp; c<br>d" } },
          { type: "list", data: { items: ["e"] } },
        ),
      ),
    ).toBe("A b & c d e");
  });

  it("cuts at a word boundary with an ellipsis", () => {
    const text = "word ".repeat(60);
    const plain = richTextToPlainText(doc({ type: "paragraph", data: { text } }), 50);
    expect(plain.length).toBeLessThanOrEqual(50);
    expect(plain.endsWith("…")).toBe(true);
    expect(plain).not.toMatch(/wor…$/);
  });
});
