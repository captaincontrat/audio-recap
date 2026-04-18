import { describe, expect, test } from "vitest";

import { EXPORT_FORMATS, type ExportFormat, isExportFormat, mimeTypeFor } from "@/lib/client/transcripts/export/formats";

// `formats.ts` is the single source of truth for the supported export
// formats, their MIME types, and the narrowing helper the panel uses
// to coerce user-supplied strings back into the `ExportFormat` union.
// The tests pin every branch so adding a new format forces a coverage
// update rather than a silent drift.

describe("EXPORT_FORMATS", () => {
  test("lists the four formats the spec requires, in the canonical panel order", () => {
    expect(EXPORT_FORMATS).toEqual(["md", "txt", "pdf", "docx"]);
  });
});

describe("mimeTypeFor", () => {
  test.each<[ExportFormat, string]>([
    ["md", "text/markdown;charset=utf-8"],
    ["txt", "text/plain;charset=utf-8"],
    ["pdf", "application/pdf"],
    ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ])("returns the canonical MIME type for %s", (format, expected) => {
    expect(mimeTypeFor(format)).toBe(expected);
  });
});

describe("isExportFormat", () => {
  test("accepts every supported format", () => {
    for (const format of EXPORT_FORMATS) {
      expect(isExportFormat(format)).toBe(true);
    }
  });

  test("rejects unknown strings", () => {
    expect(isExportFormat("html")).toBe(false);
    expect(isExportFormat("")).toBe(false);
    expect(isExportFormat("MD")).toBe(false);
  });
});
