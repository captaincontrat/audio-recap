import remarkDocx from "remark-docx";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { mimeTypeFor } from "./formats";

// DOCX conversion owned by `add-client-side-transcript-export`. The
// design pins DOCX generation to `remark-docx`, which attaches a
// browser-side `unified` compiler so the assembled markdown flows
// through the same `remark-parse` + `remark-gfm` parse used by `md`
// and `txt` before being rendered with docx.js. The compiler emits
// an `ArrayBuffer` on the VFile `.result` slot, which we wrap as a
// `Blob` tagged with the shared Office Open XML MIME type. Failures
// from the compiler surface to the orchestrator so the shared
// `ExportConversionError` wrapping stays in one place.

export async function convertToDocxBlob(markdown: string): Promise<Blob> {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDocx);
  const file = await processor.process(markdown);
  const arrayBuffer = await file.result;
  return new Blob([arrayBuffer], { type: mimeTypeFor("docx") });
}
