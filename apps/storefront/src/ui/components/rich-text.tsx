import type { RichTextBlock } from "@/lib/content/types";
import { cn } from "@/lib/utils";

/**
 * Renders sanitized EditorJS blocks (`parseRichText`, ARCHITECTURE §10.13). The block structure is
 * React; each block's inline HTML was reduced to the allowlist on the server, which is the only
 * reason `dangerouslySetInnerHTML` is acceptable here and nowhere else.
 */
export function RichText({ blocks, className }: { blocks: RichTextBlock[]; className?: string }) {
  if (blocks.length === 0) return null;
  return (
    <div className={cn("prose prose-neutral max-w-none", className)}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case "paragraph":
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by parseRichText (allowlist)
            return <p key={key} dangerouslySetInnerHTML={{ __html: block.html }} />;
          case "heading": {
            const Heading = `h${block.level}` as const;
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by parseRichText (allowlist)
            return <Heading key={key} dangerouslySetInnerHTML={{ __html: block.html }} />;
          }
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={key}>
                {block.items.map((item, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: items have no identity
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by parseRichText (allowlist)
                  <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </List>
            );
          }
          case "quote":
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by parseRichText (allowlist)
            return <blockquote key={key} dangerouslySetInnerHTML={{ __html: block.html }} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
