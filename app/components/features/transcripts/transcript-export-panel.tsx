"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ExportConversionError, EXPORT_FORMATS, type ExportFormat, exportTranscript } from "@/lib/client/transcripts/export";

// Export panel owned by `add-client-side-transcript-export`.
// Rendered on the authenticated transcript-management detail surface
// for completed transcripts the current workspace member can read.
//
// Authorization is handled by the parent page: the panel renders for
// any workspace role with transcript read access (`read_only`,
// `member`, and `admin`) because export is a workspace-scoped read
// action. Archive-state refusal is also the parent's responsibility —
// archived workspaces route the detail page to a notice surface
// before this component renders, so no archive check is duplicated
// here.
//
// The controls go through the local export helper, which assembles
// the canonical markdown document (display title + recap + transcript)
// and converts it locally. The backend contract stays markdown-first:
// no network call is issued for the conversion itself. On success we
// emit a download via an anchor element and a same-origin object URL
// so the browser names the file using the title-derived basename. On
// failure we surface a user-visible error and leave the transcript
// state untouched.

export type ExportPanelProps = {
  displayTitle: string;
  recapMarkdown: string;
  transcriptMarkdown: string;
  // When `false` the panel renders disabled controls with copy
  // explaining why the export is unavailable (e.g. the transcript is
  // still processing). The parent decides this from the current
  // status so the UI mirrors the server's completed-only rule.
  canExport: boolean;
  exportDisabledReason: string | null;
};

type ActionState = { kind: "idle" } | { kind: "working"; format: ExportFormat } | { kind: "error"; format: ExportFormat; message: string };

export function TranscriptExportPanel(props: ExportPanelProps) {
  const [state, setState] = useState<ActionState>({ kind: "idle" });

  async function handleExport(format: ExportFormat) {
    if (!props.canExport) return;
    if (state.kind === "working") return;
    setState({ kind: "working", format });
    try {
      const result = await exportTranscript({
        displayTitle: props.displayTitle,
        recapMarkdown: props.recapMarkdown,
        transcriptMarkdown: props.transcriptMarkdown,
        format,
      });
      triggerBrowserDownload(result.blob, result.filename);
      setState({ kind: "idle" });
    } catch (error) {
      const message = error instanceof ExportConversionError ? error.message : "Could not export this transcript.";
      setState({ kind: "error", format, message });
    }
  }

  const workingFormat = state.kind === "working" ? state.format : null;

  return (
    <section aria-label="Export transcript" className="flex flex-col gap-3 rounded-md border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Download</h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {EXPORT_FORMATS.map((format) => (
          <Button
            key={format}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleExport(format)}
            disabled={!props.canExport || workingFormat !== null}
            data-export-format={format}
          >
            {workingFormat === format ? `Preparing ${formatLabel(format)}…` : `Download ${formatLabel(format)}`}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {props.canExport
          ? "The file is built in your browser from the current title, recap, and transcript. Nothing is sent to the server for conversion."
          : (props.exportDisabledReason ?? "Downloads become available once this transcript finishes processing.")}
      </p>
      {state.kind === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

function formatLabel(format: ExportFormat): string {
  switch (format) {
    case "md":
      return "Markdown (.md)";
    case "txt":
      return "Plain text (.txt)";
    case "pdf":
      return "PDF";
    case "docx":
      return "Word (.docx)";
    default: {
      const exhaustive: never = format;
      throw new Error(`Unhandled export format: ${String(exhaustive)}`);
    }
  }
}

// Emit the download using a same-origin object URL + transient anchor
// element. We keep the anchor attached to `document.body` just long
// enough for the click to register; Firefox refuses to dispatch
// clicks on detached nodes in some versions. `URL.revokeObjectURL` on
// the next tick frees the blob slot even though the browser keeps a
// reference for the in-flight download.
function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
