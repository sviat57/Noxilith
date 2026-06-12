import { useMemo } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export function MarkdownView({
  content,
  onWikilinkClick,
  className,
}: {
  content: string;
  onWikilinkClick?: (target: string) => void;
  className?: string;
}) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  // Click delegation: wikilinks inside rendered HTML are real <a> elements,
  // keyboard-accessible by default; we only intercept activation.
  const handleActivate = (target: EventTarget) => {
    const el = (target as HTMLElement).closest("[data-wikilink]");
    if (el) {
      const t = el.getAttribute("data-wikilink");
      if (t && onWikilinkClick) {
        onWikilinkClick(t);
        return true;
      }
    }
    return false;
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click delegation for anchor elements inside sanitized HTML
    <div
      className={cn("md-preview", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={e => {
        if (handleActivate(e.target)) e.preventDefault();
      }}
    />
  );
}
