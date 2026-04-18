import type { Plugin, Processor } from "unified";
import { describe, expect, test, vi } from "vitest";

// `remark-docx` depends on `Iterator.prototype.reduce` which is not
// available in Node 20, so the real compiler cannot run under Vitest.
// The real output is exercised end-to-end by Playwright; the unit test
// pins that our wrapper wires `remark-parse` + `remark-gfm` ahead of
// `remark-docx`, forwards the compiler bytes untouched, and labels the
// Blob with the canonical Office Open XML MIME type.
const MOCK_DOCX_BYTES = new TextEncoder().encode("PK\u0003\u0004mock-docx").buffer;
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

vi.mock("remark-docx", () => {
  const remarkDocxMock: Plugin = function remarkDocxMock(this: Processor) {
    this.compiler = () => Promise.resolve(MOCK_DOCX_BYTES);
  };
  return { default: remarkDocxMock };
});

const { convertToDocxBlob } = await import("@/lib/client/transcripts/export/convert-docx");

describe("convertToDocxBlob", () => {
  test("labels the Blob with the DOCX MIME type and forwards the compiler bytes", async () => {
    const blob = await convertToDocxBlob("# Weekly sync\n\n## Recap\n\n- Point A");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(DOCX_MIME_TYPE);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array(MOCK_DOCX_BYTES));
  });
});
