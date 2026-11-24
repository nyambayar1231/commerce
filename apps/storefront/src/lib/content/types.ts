// View models of `src/lib/content` (ARCHITECTURE §10.3): what `src/ui` may import from here.

/**
 * One rendered EditorJS block. Every `html` is already sanitized to the inline allowlist in
 * `rich-text.ts` (`b i u s a br strong em`, safe links); the UI may insert it as HTML.
 */
export type RichTextBlock =
  | { type: "paragraph"; html: string }
  | { type: "heading"; level: 2 | 3 | 4; html: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; html: string };
