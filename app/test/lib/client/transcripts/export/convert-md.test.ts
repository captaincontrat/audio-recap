import { describe, expect, test } from "vitest";

import { convertToMarkdownBlob } from "@/lib/client/transcripts/export/convert-md";

// `convertToMarkdownBlob` is the trivial direct-download branch of
// the capability: the assembled canonical markdown is already the
// exact body the design prescribes, so the test pins that the
// returned Blob carries the identical bytes and the stable
// `text/markdown` MIME type used everywhere else in the pipeline.

describe("convertToMarkdownBlob", () => {
  test("returns a Blob with the canonical markdown text and MIME type", async () => {
    const markdown = "# Weekly sync\n\n## Recap\n\n- Point A";
    const blob = convertToMarkdownBlob(markdown);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("text/markdown;charset=utf-8");
    const text = await blob.text();
    expect(text).toBe(markdown);
  });

  test("emits an empty Blob for an empty input so the caller still gets a download", async () => {
    const blob = convertToMarkdownBlob("");
    expect(blob.size).toBe(0);
    expect(await blob.text()).toBe("");
  });
});
