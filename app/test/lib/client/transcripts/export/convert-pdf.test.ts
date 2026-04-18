import type { Plugin, Processor } from "unified";
import { describe, expect, test, vi } from "vitest";

// `remark-pdf`'s real compiler depends on Node APIs shimmed via
// package `imports` for the browser; running it under Vitest's Node
// runtime breaks ESM resolution for `@jsamr/counter-style/presets/*`.
// The real output is exercised end-to-end by Playwright; the unit test
// just pins that our wrapper wires `remark-parse` + `remark-gfm` ahead
// of `remark-pdf`, forwards the compiler bytes untouched, and labels
// the Blob with the canonical PDF MIME type.
const MOCK_PDF_BYTES = new TextEncoder().encode("%PDF-mock-stream").buffer;

vi.mock("remark-pdf", () => {
  const remarkPdfMock: Plugin = function remarkPdfMock(this: Processor) {
    this.compiler = () => Promise.resolve(MOCK_PDF_BYTES);
  };
  return { default: remarkPdfMock };
});

const { convertToPdfBlob } = await import("@/lib/client/transcripts/export/convert-pdf");

describe("convertToPdfBlob", () => {
  test("labels the Blob with the PDF MIME type and forwards the compiler bytes", async () => {
    const blob = await convertToPdfBlob("# Weekly sync\n\n## Recap\n\n- Point A");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array(MOCK_PDF_BYTES));
  });
});
