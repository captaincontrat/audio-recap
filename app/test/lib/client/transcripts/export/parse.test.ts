import { describe, expect, test } from "vitest";

import { parseExportMarkdown } from "@/lib/client/transcripts/export/parse";

// `parseExportMarkdown` is the shared entry point for the
// `unified` / `remark-parse` / `remark-gfm` parse used by every
// export format. Downstream converters (`txt`, `pdf`, `docx`) rely on
// the returned `mdast` tree matching the same grammar, so the tests
// pin both the structural shape of the tree and the GFM-specific
// extension (tables, strikethrough) that distinguishes this parse
// from a vanilla CommonMark parse.

describe("parseExportMarkdown", () => {
  test("produces an mdast Root tree with the expected heading structure", () => {
    const tree = parseExportMarkdown("# Weekly sync\n\n## Recap\n\n- Point A");
    expect(tree.type).toBe("root");
    const headings = tree.children.filter((node) => node.type === "heading");
    expect(headings).toHaveLength(2);
    expect(headings[0]).toMatchObject({ depth: 1 });
    expect(headings[1]).toMatchObject({ depth: 2 });
  });

  test("understands GFM extensions so downstream formats render them consistently", () => {
    const tree = parseExportMarkdown("| speaker | line |\n| --- | --- |\n| 1 | hello |\n\n~~old~~ new text");
    const tableNode = tree.children.find((node) => node.type === "table");
    expect(tableNode).toBeDefined();

    const paragraph = tree.children.find((node) => node.type === "paragraph");
    expect(paragraph).toBeDefined();
    const hasDeleteNode = paragraph && "children" in paragraph ? paragraph.children.some((child) => child.type === "delete") : false;
    expect(hasDeleteNode).toBe(true);
  });
});
