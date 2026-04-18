// Barrel for the client-side transcript-export module owned by
// `add-client-side-transcript-export`. Importers should reach in
// through this entry point so the file layout can evolve without
// breaking the detail view or future callers.

export { assembleExportDocument, type ExportDocumentSource } from "./assemble";

export { convertToDocxBlob } from "./convert-docx";
export { convertToMarkdownBlob } from "./convert-md";
export { convertToPdfBlob } from "./convert-pdf";
export { convertToPlainTextBlob } from "./convert-txt";

export { ExportConversionError } from "./errors";

export { buildExportFilename, EXPORT_FILENAME_FALLBACK } from "./filename";

export { EXPORT_FORMATS, type ExportFormat, isExportFormat, mimeTypeFor } from "./formats";

export { exportTranscript, type ExportTranscriptArgs, type ExportTranscriptResult } from "./export-transcript";

export { parseExportMarkdown } from "./parse";
