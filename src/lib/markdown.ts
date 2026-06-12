import DOMPurify from "dompurify";
import { Marked } from "marked";

/** Extract [[wikilink]] targets from markdown content. */
export function extractWikilinks(content: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\][|]+)(?:\|[^\][]*)?\]\]/g;
  let m = re.exec(content);
  while (m !== null) {
    const t = m[1].trim();
    if (t) out.push(t);
    m = re.exec(content);
  }
  return [...new Set(out)];
}

/** Extract #tags from markdown content (unicode-aware, skips headings). */
export function extractTags(content: string): string[] {
  const out: string[] = [];
  const re = /(^|\s)#([\p{L}\p{N}_-]+)/gmu;
  let m = re.exec(content);
  while (m !== null) {
    out.push(m[2].toLowerCase());
    m = re.exec(content);
  }
  return [...new Set(out)];
}

const marked = new Marked({
  gfm: true,
  breaks: true,
});

marked.use({
  extensions: [
    {
      name: "wikilink",
      level: "inline",
      start(src: string) {
        return src.indexOf("[[");
      },
      tokenizer(src: string) {
        const match = /^\[\[([^\][|]+)(?:\|([^\][]*))?\]\]/.exec(src);
        if (match) {
          return {
            type: "wikilink",
            raw: match[0],
            target: match[1].trim(),
            label: (match[2] ?? match[1]).trim(),
          };
        }
        return undefined;
      },
      renderer(token) {
        const t = token as unknown as { target: string; label: string };
        const target = escapeHtml(t.target);
        const label = escapeHtml(t.label);
        return `<a class="wikilink" data-wikilink="${target}" href="#">${label}</a>`;
      },
    },
    {
      name: "hashtag",
      level: "inline",
      start(src: string) {
        return src.search(/#[\p{L}\p{N}_-]/u);
      },
      tokenizer(src: string, tokens) {
        const match = /^#([\p{L}\p{N}_-]+)/u.exec(src);
        // Only treat as tag when not part of a word (marked passes inline rest)
        if (match) {
          void tokens;
          return {
            type: "hashtag",
            raw: match[0],
            tag: match[1],
          };
        }
        return undefined;
      },
      renderer(token) {
        const t = token as unknown as { tag: string };
        const tag = escapeHtml(t.tag);
        return `<span class="md-tag" data-tag="${tag.toLowerCase()}">#${tag}</span>`;
      },
    },
  ],
});

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Render markdown (with wikilinks + tags) to sanitized HTML. */
export function renderMarkdown(content: string): string {
  const html = marked.parse(content, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["data-wikilink", "data-tag"],
  });
}

export function countWords(content: string): number {
  const words = content
    .replace(/[#*`>[\]()|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.length;
}
