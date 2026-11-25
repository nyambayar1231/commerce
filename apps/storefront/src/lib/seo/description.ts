import { parseRichText, richTextToPlainText } from "@/lib/content/rich-text";

// Meta descriptions (ARCHITECTURE §10.14): plain text, at most 160 characters, cut on a word
// boundary with "…". Category and collection descriptions use the first EditorJS paragraph only.

/** Plain text of the first paragraph of an EditorJS document; "" when it has none. */
export function firstParagraphDescription(value: unknown): string {
  const paragraph = parseRichText(value).find((block) => block.type === "paragraph");
  if (paragraph === undefined || paragraph.type !== "paragraph") return "";
  // The block's html is already sanitized; the plain-text helper strips tags, decodes entities and
  // truncates.
  return richTextToPlainText({ blocks: [{ type: "paragraph", data: { text: paragraph.html } }] });
}

/** The `description` field of a route's metadata: omitted when there is no text. */
export function descriptionOrUndefined(text: string): string | undefined {
  return text === "" ? undefined : text;
}
