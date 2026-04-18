import { beforeEach, describe, expect, test, vi } from "vitest";

import { assembleExportDocument } from "@/lib/client/transcripts/export/assemble";
import { ExportConversionError } from "@/lib/client/transcripts/export/errors";
import { buildExportFilename } from "@/lib/client/transcripts/export/filename";
import type { ExportFormat } from "@/lib/client/transcripts/export/formats";

// The orchestrator is where the spec's invariants live: canonical
// ordering from `assembleExportDocument`, title-derived filenames, a
// single conversion entry point per format, and uniform
// `ExportConversionError` wrapping. The tests keep the real assembly
// and filename helpers so ordering and sanitization cannot regress,
// while mocking the four format-specific converters so the branches
// can be asserted independently of the heavy `remark-pdf` and
// `remark-docx` runtimes.
const { convertToMarkdownMock, convertToPlainTextMock, convertToPdfMock, convertToDocxMock } = vi.hoisted(() => ({
  convertToMarkdownMock: vi.fn<(markdown: string) => Blob>(),
  convertToPlainTextMock: vi.fn<(tree: unknown) => Blob>(),
  convertToPdfMock: vi.fn<(markdown: string) => Promise<Blob>>(),
  convertToDocxMock: vi.fn<(markdown: string) => Promise<Blob>>(),
}));

vi.mock("@/lib/client/transcripts/export/convert-md", () => ({
  convertToMarkdownBlob: convertToMarkdownMock,
}));

vi.mock("@/lib/client/transcripts/export/convert-txt", () => ({
  convertToPlainTextBlob: convertToPlainTextMock,
}));

vi.mock("@/lib/client/transcripts/export/convert-pdf", () => ({
  convertToPdfBlob: convertToPdfMock,
}));

vi.mock("@/lib/client/transcripts/export/convert-docx", () => ({
  convertToDocxBlob: convertToDocxMock,
}));

const { exportTranscript } = await import("@/lib/client/transcripts/export/export-transcript");

const SOURCE = {
  displayTitle: "Weekly Sync",
  recapMarkdown: "- Decision A\n- Decision B",
  transcriptMarkdown: "Speaker 1: Hello world.",
};

describe("exportTranscript", () => {
  beforeEach(() => {
    convertToMarkdownMock.mockReset();
    convertToPlainTextMock.mockReset();
    convertToPdfMock.mockReset();
    convertToDocxMock.mockReset();
  });

  test("md route forwards the assembled markdown and returns a title-derived filename", async () => {
    const blob = new Blob(["md-bytes"], { type: "text/markdown;charset=utf-8" });
    convertToMarkdownMock.mockReturnValue(blob);

    const result = await exportTranscript({ ...SOURCE, format: "md" });

    expect(convertToMarkdownMock).toHaveBeenCalledTimes(1);
    expect(convertToMarkdownMock).toHaveBeenCalledWith(assembleExportDocument(SOURCE));
    expect(convertToPlainTextMock).not.toHaveBeenCalled();
    expect(convertToPdfMock).not.toHaveBeenCalled();
    expect(convertToDocxMock).not.toHaveBeenCalled();
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe(buildExportFilename({ displayTitle: SOURCE.displayTitle, format: "md" }));
  });

  test("txt route feeds the plain-text converter the parsed tree for the same assembled document", async () => {
    const blob = new Blob(["txt-bytes"], { type: "text/plain;charset=utf-8" });
    convertToPlainTextMock.mockReturnValue(blob);

    const result = await exportTranscript({ ...SOURCE, format: "txt" });

    expect(convertToPlainTextMock).toHaveBeenCalledTimes(1);
    const [tree] = convertToPlainTextMock.mock.calls[0];
    expect(tree).toMatchObject({ type: "root" });
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe(buildExportFilename({ displayTitle: SOURCE.displayTitle, format: "txt" }));
  });

  test("pdf route defers to the pdf converter and returns its blob", async () => {
    const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" });
    convertToPdfMock.mockResolvedValue(blob);

    const result = await exportTranscript({ ...SOURCE, format: "pdf" });

    expect(convertToPdfMock).toHaveBeenCalledWith(assembleExportDocument(SOURCE));
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe(buildExportFilename({ displayTitle: SOURCE.displayTitle, format: "pdf" }));
  });

  test("docx route defers to the docx converter and returns its blob", async () => {
    const blob = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    convertToDocxMock.mockResolvedValue(blob);

    const result = await exportTranscript({ ...SOURCE, format: "docx" });

    expect(convertToDocxMock).toHaveBeenCalledWith(assembleExportDocument(SOURCE));
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe(buildExportFilename({ displayTitle: SOURCE.displayTitle, format: "docx" }));
  });

  test("wraps converter failures in ExportConversionError tagged with the format, preserving cause", async () => {
    const underlying = new Error("pdf compiler crashed");
    convertToPdfMock.mockRejectedValue(underlying);

    await expect(exportTranscript({ ...SOURCE, format: "pdf" })).rejects.toMatchObject({
      name: "ExportConversionError",
      format: "pdf",
      cause: underlying,
    });

    await expect(exportTranscript({ ...SOURCE, format: "pdf" })).rejects.toBeInstanceOf(ExportConversionError);
  });

  test("rejects unknown formats through the exhaustive switch guard", async () => {
    await expect(exportTranscript({ ...SOURCE, format: "xml" as ExportFormat })).rejects.toBeInstanceOf(ExportConversionError);
  });
});
