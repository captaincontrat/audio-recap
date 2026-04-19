import { describe, expect, test } from "vitest";

const { convertToPdfBlob } = await import("@/lib/client/transcripts/export/convert-pdf");

describe("convertToPdfBlob", () => {
  test("builds a browser PDF blob with the canonical MIME type", async () => {
    const blob = await convertToPdfBlob("# Weekly sync\n\n## Recap\n\n- Point A");

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder("ascii").decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(32);
  });
});
