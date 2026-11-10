// EditorJS descriptions, shared by categories and products (Saleor's editorjs_to_text).

type ParsedDescription = { value: unknown; plaintext: string };

/**
 * Validates an EditorJS document and extracts its plaintext. `null` is a valid "no description"
 * value; anything else must be an object with a `blocks` array, or the result is `null`.
 */
export function parseDescription(input: unknown): ParsedDescription | null {
  if (input === null) return { value: null, plaintext: "" };
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const blocks = (input as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return null;

  const parts: string[] = [];
  for (const block of blocks) {
    if (typeof block !== "object" || block === null) continue;
    const data = (block as { data?: unknown }).data;
    if (typeof data !== "object" || data === null) continue;
    const text = (data as { text?: unknown }).text;
    if (typeof text !== "string") continue;
    const part = text.replace(/<[^>]*>/g, "");
    if (part) parts.push(part);
  }
  return { value: input, plaintext: parts.join(" ").trim() };
}
