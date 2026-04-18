// Export-specific error classes owned by
// `add-client-side-transcript-export`. Callers branch on
// `ExportConversionError` to distinguish "the browser-side conversion
// failed" from generic network / auth errors elsewhere in the UI.
// Wrapping the underlying failure in `cause` keeps the original stack
// accessible for diagnostics without forcing the user-visible panel to
// leak library-internal details.

import type { ExportFormat } from "./formats";

export class ExportConversionError extends Error {
  readonly format: ExportFormat;

  constructor(format: ExportFormat, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ExportConversionError";
    this.format = format;
  }
}
