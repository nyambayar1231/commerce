// The detail page edits the description as plain text until a rich-text editor is chosen (PLAN.md
// M2 decision 4). Saleor stores EditorJS JSON; we keep that format: one paragraph block per
// paragraph of text (separated by a blank line), as Saleor's create dialog does for one paragraph.
import type { OutputData } from "../categories/components/CreateCategoryDialog/CreateCategoryDialog";

interface EditorJsBlock {
  type?: unknown;
  data?: { text?: unknown };
}

/** Parses the API's `JSONString` value (a JSON document inside a string); null when unreadable. */
const parseJsonString = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/** EditorJS JSON, as the API's `JSONString` or already parsed → editable plain text. */
export const editorJsToPlainText = (description: unknown): string => {
  const blocks = (parseJsonString(description) as { blocks?: unknown } | null)?.blocks;

  if (!Array.isArray(blocks)) {
    return "";
  }

  return (blocks as EditorJsBlock[])
    .map((block) => (typeof block?.data?.text === "string" ? block.data.text : ""))
    .map((text) => text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""))
    .filter((text) => text !== "")
    .join("\n\n");
};

/** Plain text → EditorJS JSON, or null when blank (Saleor sends no description then). */
export const plainTextToEditorJs = (text: string): OutputData | null => {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return null;
  }

  return {
    blocks: paragraphs.map((paragraph) => ({ type: "paragraph", data: { text: paragraph } })),
  };
};
