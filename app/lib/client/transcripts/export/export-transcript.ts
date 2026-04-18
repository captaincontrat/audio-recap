import { assembleExportDocument, type ExportDocumentSource } from "./assemble";
import { convertToDocxBlob } from "./convert-docx";
import { convertToMarkdownBlob } from "./convert-md";
import { convertToPdfBlob } from "./convert-pdf";
import { convertToPlainTextBlob } from "./convert-txt";
import { ExportConversionError } from "./errors";
import { buildExportFilename } from "./filename";
import type { ExportFormat } from "./formats";
import { parseExportMarkdown } from "./parse";

// Client-side orchestrator for the transcript export capability owned
// by `add-client-side-transcript-export`. The panel calls one entry
// point for every format so the spec's invariants — canonical
// ordering, markdown-first backend contract, title-derived filename,
// and uniform error handling — are enforced in one place rather than
// duplicated across individual button handlers.
//
// `assembleExportDocument` and `parseExportMarkdown` implement the
// shared `unified` / `remark-parse` / `remark-gfm` parse the design
// requires so `md`, `txt`, `pdf`, and `docx` branch off the same
// structural interpretation of the assembled document. `md` uses the
// raw string, `txt` uses the parsed tree, and `pdf` / `docx`
// re-drive their respective compilers against the same input string
// (each compiler installs its own `Compiler` on `unified`).
//
// Any failure bubbling out of the conversion step is wrapped in an
// `ExportConversionError` tagged with the target format so the panel
// can render the user-visible message without sniffing the cause
// chain. The original error is kept on `cause` for diagnostics.

export type ExportTranscriptArgs = ExportDocumentSource & {
  format: ExportFormat;
};

export type ExportTranscriptResult = {
  blob: Blob;
  filename: string;
};

export async function exportTranscript(args: ExportTranscriptArgs): Promise<ExportTranscriptResult> {
  const markdown = assembleExportDocument(args);
  const filename = buildExportFilename({ displayTitle: args.displayTitle, format: args.format });

  try {
    const blob = await convertToFormat(markdown, args.format);
    return { blob, filename };
  } catch (error) {
    throw new ExportConversionError(args.format, `Could not produce a ${args.format} download.`, { cause: error });
  }
}

async function convertToFormat(markdown: string, format: ExportFormat): Promise<Blob> {
  switch (format) {
    case "md":
      return convertToMarkdownBlob(markdown);
    case "txt": {
      const tree = parseExportMarkdown(markdown);
      return convertToPlainTextBlob(tree);
    }
    case "pdf":
      return convertToPdfBlob(markdown);
    case "docx":
      return convertToDocxBlob(markdown);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unhandled export format: ${String(exhaustive)}`);
    }
  }
}
