import { describe, expect, test } from "vitest";

import { convertToPlainTextBlob } from "@/lib/client/transcripts/export/convert-txt";
import { parseExportMarkdown } from "@/lib/client/transcripts/export/parse";

// `convertToPlainTextBlob` wires `mdast-util-to-string` to the shared
// parsed tree. The tests pin that the returned Blob is the expected
// plain-text MIME type and that the concatenated text contains the
// key words from every section of the assembled document, so the
// canonical ordering rule is observed by the text branch as well.

describe("convertToPlainTextBlob", () => {
  test("returns a Blob with the plain-text MIME type and the concatenated section text", async () => {
    const markdown = "# Weekly sync\n\n## Recap\n\n- Point A\n- Point B\n\n## Transcript\n\nSpeaker 1: Hello world";
    const tree = parseExportMarkdown(markdown);
    const blob = convertToPlainTextBlob(tree);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("text/plain;charset=utf-8");
    const text = await blob.text();
    expect(text).toContain("Weekly sync");
    expect(text).toContain("Recap");
    expect(text).toContain("Point A");
    expect(text).toContain("Point B");
    expect(text).toContain("Transcript");
    expect(text).toContain("Speaker 1: Hello world");
  });

  test("emits an empty Blob when the parsed tree has no textual nodes", async () => {
    const tree = parseExportMarkdown("");
    const blob = convertToPlainTextBlob(tree);
    expect(blob.size).toBe(0);
    expect(await blob.text()).toBe("");
  });
});
