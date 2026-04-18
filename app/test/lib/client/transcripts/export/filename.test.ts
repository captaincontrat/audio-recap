import { describe, expect, test } from "vitest";

import { buildExportFilename, EXPORT_FILENAME_FALLBACK } from "@/lib/client/transcripts/export/filename";

// `buildExportFilename` pins the spec's title-derived download-name
// rule. The sanitizer has to reject anything that would produce a
// hostile path or a hidden file name on common operating systems, fall
// back to a neutral stem when the title sanitizes to nothing, and cap
// the length so the combined `<title>.<ext>` never approaches the
// 255-byte filesystem limit. Each behaviour below maps to one of
// those requirements.

describe("buildExportFilename", () => {
  test("appends the selected extension to the sanitized title", () => {
    expect(buildExportFilename({ displayTitle: "Weekly sync", format: "md" })).toBe("Weekly sync.md");
    expect(buildExportFilename({ displayTitle: "Weekly sync", format: "pdf" })).toBe("Weekly sync.pdf");
  });

  test("replaces path-reserved punctuation with spaces and collapses whitespace runs", () => {
    const filename = buildExportFilename({
      displayTitle: `Board / Q3 "planning": <draft>*?|\\`,
      format: "docx",
    });
    expect(filename).toBe("Board Q3 planning draft.docx");
  });

  test("strips control characters", () => {
    const filename = buildExportFilename({
      displayTitle: "Line one\nLine two\tand\u0007bell",
      format: "txt",
    });
    expect(filename).toBe("Line one Line two and bell.txt");
  });

  test("strips leading and trailing dots so the output is never a hidden file or ends in a dot", () => {
    expect(buildExportFilename({ displayTitle: ".hidden.", format: "md" })).toBe("hidden.md");
    expect(buildExportFilename({ displayTitle: "...", format: "md" })).toBe(`${EXPORT_FILENAME_FALLBACK}.md`);
  });

  test("uses the fallback stem when every character is stripped by sanitization", () => {
    expect(buildExportFilename({ displayTitle: "", format: "md" })).toBe(`${EXPORT_FILENAME_FALLBACK}.md`);
    expect(buildExportFilename({ displayTitle: "   ", format: "txt" })).toBe(`${EXPORT_FILENAME_FALLBACK}.txt`);
    expect(buildExportFilename({ displayTitle: "\u0000\u0001", format: "pdf" })).toBe(`${EXPORT_FILENAME_FALLBACK}.pdf`);
  });

  test("caps the sanitized stem length so combined filename stays well below filesystem limits", () => {
    const longTitle = "a".repeat(500);
    const filename = buildExportFilename({ displayTitle: longTitle, format: "docx" });
    expect(filename.endsWith(".docx")).toBe(true);
    const stem = filename.slice(0, -".docx".length);
    expect(stem.length).toBeLessThanOrEqual(120);
    expect(stem).toBe("a".repeat(120));
  });

  test("trims trailing whitespace introduced by the length cap", () => {
    const title = `${"word ".repeat(30)}tail`;
    const filename = buildExportFilename({ displayTitle: title, format: "md" });
    const stem = filename.slice(0, -".md".length);
    expect(stem.endsWith(" ")).toBe(false);
  });
});
