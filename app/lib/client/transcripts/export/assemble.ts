// Canonical client-side export document assembly owned by
// `add-client-side-transcript-export`. The design pins a single
// document order every format derives from:
//
//   1. display title (H1)
//   2. "Recap" section (H2) wrapping the canonical recap markdown
//   3. "Transcript" section (H2) wrapping the canonical transcript
//      markdown
//
// Keeping the assembly inside one pure function lets every format
// (`md`, `txt`, `pdf`, `docx`) branch off the same string so the four
// downloads stay structurally identical, and it isolates the ordering
// rule from the conversion layer for unit tests.

export type ExportDocumentSource = {
  displayTitle: string;
  recapMarkdown: string;
  transcriptMarkdown: string;
};

export function assembleExportDocument(source: ExportDocumentSource): string {
  const title = source.displayTitle.trim();
  const recap = source.recapMarkdown.trim();
  const transcript = source.transcriptMarkdown.trim();

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push("## Recap");
  lines.push("");
  lines.push(recap.length > 0 ? recap : "_This section is empty._");
  lines.push("");
  lines.push("## Transcript");
  lines.push("");
  lines.push(transcript.length > 0 ? transcript : "_This section is empty._");
  lines.push("");
  return lines.join("\n");
}
