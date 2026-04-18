import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkPdf from "remark-pdf";
import { unified } from "unified";

import { mimeTypeFor } from "./formats";

// PDF conversion owned by `add-client-side-transcript-export`. The
// design pins PDF generation to `remark-pdf`, which attaches a
// browser-side `unified` compiler so the assembled markdown flows
// through the same `remark-parse` + `remark-gfm` parse used by `md`
// and `txt` before being rendered with pdfkit. The compiler emits an
// `ArrayBuffer` on the VFile `.result` slot, which we wrap as a
// `Blob` tagged with the shared `application/pdf` MIME type.
// Failures from the compiler surface to the orchestrator so the
// shared `ExportConversionError` wrapping stays in one place.

export async function convertToPdfBlob(markdown: string): Promise<Blob> {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkPdf);
  const file = await processor.process(markdown);
  const arrayBuffer = await file.result;
  return new Blob([arrayBuffer], { type: mimeTypeFor("pdf") });
}
