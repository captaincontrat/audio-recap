import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

// Single-source markdown parser for the client-side export pipeline.
// The design rule is that every export format branches off one
// `unified` / `remark-parse` / `remark-gfm` parse so `md`, `txt`,
// `pdf`, and `docx` share the same structural interpretation of the
// assembled document (headings, tables, strikethrough, task lists,
// etc.).
//
// `parseExportMarkdown` returns the parsed `mdast` tree ready for
// downstream conversion (`mdast-util-to-string` for `txt` and other
// format-specific compilers such as the DOCX pipeline).

export function parseExportMarkdown(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkGfm);
  return processor.parse(markdown);
}
