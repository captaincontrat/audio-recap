import { mimeTypeFor } from "./formats";

// Markdown conversion owned by `add-client-side-transcript-export`.
// The `md` path is intentionally the trivial one: the assembled
// canonical markdown is already the exact body the design prescribes
// for download, so no re-serialization is performed and no transforms
// are applied. Wrapping the string in a `Blob` with the shared
// `text/markdown` MIME type keeps the invocation pattern symmetric
// with the binary-format siblings (`pdf`, `docx`) so the panel can
// treat every branch the same way. Any runtime failure (e.g. a Blob
// constructor error in a hostile environment) propagates to the
// orchestrator, which wraps it in the shared `ExportConversionError`.

export function convertToMarkdownBlob(markdown: string): Blob {
  return new Blob([markdown], { type: mimeTypeFor("md") });
}
