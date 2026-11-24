import { FilterXSS } from "xss";
import type { RichTextBlock } from "./types";

// Rich text from the API (EditorJS JSON in a `JSONString`: product, category, collection and page
// descriptions) as sanitized blocks (ARCHITECTURE §10.13). The block structure becomes React
// elements; only the inline HTML inside a block is kept, and only what this allowlist permits.
// Staff write this text, but a compromised staff account must not become stored XSS on the shop.

const SAFE_HREF = /^(https?:|mailto:)/i;

const inline = new FilterXSS({
  whiteList: {
    a: ["href"],
    b: [],
    strong: [],
    i: [],
    em: [],
    u: [],
    s: [],
    br: [],
  },
  stripIgnoreTag: true, // a tag outside the allowlist is removed, its text kept
  stripIgnoreTagBody: ["script", "style", "iframe", "noscript", "template"],
  // Runs on every allowed attribute after the allowlist. Only http(s) and mailto hrefs survive;
  // the value is escaped for the attribute.
  safeAttrValue(tag, name, value) {
    const trimmed = value.trim();
    if (tag === "a" && name === "href" && SAFE_HREF.test(trimmed)) {
      return escapeAttrValue(trimmed);
    }
    return "";
  },
});

/** The library's attribute escaping (quotes, angle brackets, ampersands). */
function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline HTML of one block, sanitized. */
export function sanitizeInline(html: string): string {
  // The output holds only allowlisted tags, so every remaining "<a" opens a sanitized link: make
  // it open in a new tab without a referrer or an opener.
  return inline
    .process(html)
    .replace(/<a\b/g, '<a rel="noopener noreferrer nofollow" target="_blank"')
    .trim();
}

type RawBlock = { type?: unknown; data?: Record<string, unknown> };

function parseDocument(value: unknown): RawBlock[] {
  let document = value;
  if (typeof value === "string") {
    try {
      document = JSON.parse(value);
    } catch {
      return [];
    }
  }
  const blocks = (document as { blocks?: unknown } | null)?.blocks;
  return Array.isArray(blocks) ? (blocks as RawBlock[]) : [];
}

/** List items are strings (EditorJS list 1.x) or `{ content, items }` (nested list 2.x). */
function listItems(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (typeof item === "string") return [sanitizeInline(item)];
    if (item !== null && typeof item === "object") {
      const { content, items: children } = item as { content?: unknown; items?: unknown };
      const own = typeof content === "string" ? [sanitizeInline(content)] : [];
      return [...own, ...listItems(children)]; // nested items flattened: one level is enough
    }
    return [];
  });
}

/**
 * The renderable blocks of an EditorJS document (a JSON string, an object or null). Unknown block
 * types, malformed blocks and blocks that are empty after sanitizing are dropped; bad JSON is an
 * empty document, never an error.
 */
export function parseRichText(value: unknown): RichTextBlock[] {
  const out: RichTextBlock[] = [];
  for (const block of parseDocument(value)) {
    const data = block?.data;
    if (data === null || typeof data !== "object") continue;
    const text = typeof data.text === "string" ? sanitizeInline(data.text) : "";
    switch (block.type) {
      case "paragraph":
        if (text) out.push({ type: "paragraph", html: text });
        break;
      case "header": {
        // The page title is the h1; document headings start at h2.
        const level = Math.min(4, Math.max(2, Number(data.level) || 2)) as 2 | 3 | 4;
        if (text) out.push({ type: "heading", level, html: text });
        break;
      }
      case "list": {
        const items = listItems(data.items).filter(Boolean);
        if (items.length > 0) out.push({ type: "list", ordered: data.style === "ordered", items });
        break;
      }
      case "quote":
        if (text) out.push({ type: "quote", html: text });
        break;
      default:
        break;
    }
  }
  return out;
}

/** Plain text of a document, for meta descriptions: tags removed, entities decoded, cut at `max`. */
export function richTextToPlainText(value: unknown, max = 160): string {
  const text = parseRichText(value)
    .flatMap((block) => (block.type === "list" ? block.items : [block.html]))
    .map((html) =>
      html
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&"),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
