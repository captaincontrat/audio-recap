// Supported client-side export formats owned by
// `add-client-side-transcript-export`. The ordered tuple is the source
// of truth the panel iterates over so adding a new format is a
// single-location change the type system enforces on every caller.

export const EXPORT_FORMATS = ["md", "txt", "pdf", "docx"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// Stable MIME types for each format. Centralized so the conversion
// helpers, the panel, and the tests all agree on what `Blob.type`
// values the download flow emits.
const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  md: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function mimeTypeFor(format: ExportFormat): string {
  return EXPORT_MIME_TYPES[format];
}

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}
