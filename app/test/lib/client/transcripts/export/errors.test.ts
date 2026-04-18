import { describe, expect, test } from "vitest";

import { ExportConversionError } from "@/lib/client/transcripts/export/errors";

// `ExportConversionError` is the single error type the panel surfaces
// to the user. The tests pin that it is a real `Error`, tags the
// target format, and preserves the underlying cause so operator-side
// diagnostics are not lost when the UI shows a friendly message.

describe("ExportConversionError", () => {
  test("is an Error subclass carrying the target format and message", () => {
    const err = new ExportConversionError("pdf", "PDF conversion failed");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ExportConversionError);
    expect(err.name).toBe("ExportConversionError");
    expect(err.format).toBe("pdf");
    expect(err.message).toBe("PDF conversion failed");
  });

  test("preserves the underlying cause when one is supplied", () => {
    const cause = new Error("underlying compiler failure");
    const err = new ExportConversionError("docx", "DOCX conversion failed", { cause });
    expect(err.cause).toBe(cause);
  });
});
