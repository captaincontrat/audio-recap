"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mirrors the shape returned by `toDetailView` on the server. Client
// bundle stays free of server-only imports.
export type DetailView = {
  id: string;
  workspaceId: string;
  status: "queued" | "preprocessing" | "transcribing" | "generating_recap" | "generating_title" | "finalizing" | "retrying" | "completed" | "failed";
  displayTitle: string;
  transcriptMarkdown: string;
  recapMarkdown: string;
  sourceMediaKind: "audio" | "video";
  originalDurationSec: number | null;
  submittedWithNotes: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failure: { code: string | null; summary: string | null } | null;
};

type Props = {
  workspaceSlug: string;
  transcriptId: string;
  initial: DetailView;
};

type FetchState = { kind: "idle" } | { kind: "refreshing" } | { kind: "error"; message: string };

// Interactive detail view. The server component is responsible for
// the not-found / archived / access-denied branches before this
// component ever renders, so here we only own:
//   - the current snapshot of the detail view
//   - a refresh button that re-fetches the detail payload (the spec
//     calls this "retry from recoverable fetch errors")
//   - a "refreshing" loading state and a fetch-error state that
//     stays visible until the retry succeeds
export function TranscriptDetailView({ workspaceSlug, transcriptId, initial }: Props) {
  const [state, setState] = useState<DetailView>(initial);
  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });

  const refresh = useCallback(async () => {
    setFetchState({ kind: "refreshing" });
    try {
      const next = await fetchDetail({ workspaceSlug, transcriptId });
      setState(next);
      setFetchState({ kind: "idle" });
    } catch (err) {
      setFetchState({
        kind: "error",
        message: err instanceof DetailFetchError ? err.message : "Could not refresh this transcript.",
      });
    }
  }, [workspaceSlug, transcriptId]);

  const isProcessing = !(state.status === "completed" || state.status === "failed");

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{state.displayTitle}</h1>
          <StatusBadge status={state.status} />
        </div>
        <DetailMetadata state={state} />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={refresh} disabled={fetchState.kind === "refreshing"}>
            {fetchState.kind === "refreshing" ? "Refreshing…" : "Refresh"}
          </Button>
          {fetchState.kind === "refreshing" ? <p className="text-xs text-muted-foreground">Fetching latest content…</p> : null}
          {fetchState.kind === "error" ? (
            <p role="alert" className="text-xs text-destructive">
              {fetchState.message}
            </p>
          ) : null}
        </div>
      </header>

      {state.status === "failed" ? (
        <FailureNotice summary={state.failure?.summary ?? null} />
      ) : isProcessing ? (
        <ProcessingNotice status={state.status} />
      ) : null}

      <DetailSection title="Recap" markdown={state.recapMarkdown} />
      <DetailSection title="Transcript" markdown={state.transcriptMarkdown} variant="transcript" />
    </article>
  );
}

function DetailSection({ title, markdown, variant = "recap" }: { title: string; markdown: string; variant?: "recap" | "transcript" }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {markdown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
          {title === "Recap" ? "The recap will appear here once processing completes." : "The transcript will appear here once processing completes."}
        </p>
      ) : (
        <pre
          className={cn(
            "whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/20 p-4 font-sans text-sm leading-relaxed text-foreground",
            variant === "transcript" ? "max-h-[32rem] overflow-y-auto" : undefined,
          )}
        >
          {markdown}
        </pre>
      )}
    </section>
  );
}

function DetailMetadata({ state }: { state: DetailView }) {
  const createdAt = new Date(state.createdAt).toLocaleString();
  const updatedAt = new Date(state.updatedAt).toLocaleString();
  const completedAt = state.completedAt ? new Date(state.completedAt).toLocaleString() : null;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <dt>Transcript</dt>
      <dd className="font-mono text-foreground">{state.id}</dd>
      <dt>Source</dt>
      <dd>{state.sourceMediaKind === "video" ? "Video" : "Audio"}</dd>
      {state.originalDurationSec !== null ? (
        <>
          <dt>Duration</dt>
          <dd>{formatDuration(state.originalDurationSec)}</dd>
        </>
      ) : null}
      <dt>Notes</dt>
      <dd>{state.submittedWithNotes ? "Provided" : "None"}</dd>
      <dt>Created</dt>
      <dd>{createdAt}</dd>
      <dt>Updated</dt>
      <dd>{updatedAt}</dd>
      {completedAt ? (
        <>
          <dt>Completed</dt>
          <dd>{completedAt}</dd>
        </>
      ) : null}
    </dl>
  );
}

function StatusBadge({ status }: { status: DetailView["status"] }) {
  const tone = statusTone(status);
  const label = statusLabel(status);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", tone)}>{label}</span>
  );
}

function statusTone(status: DetailView["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "failed":
      return "border-destructive/40 bg-destructive/5 text-destructive";
    case "retrying":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-border/70 bg-muted text-muted-foreground";
  }
}

function statusLabel(status: DetailView["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "preprocessing":
      return "Preprocessing";
    case "transcribing":
      return "Transcribing";
    case "generating_recap":
      return "Writing recap";
    case "generating_title":
      return "Titling";
    case "finalizing":
      return "Finalizing";
    case "retrying":
      return "Retrying";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled transcript status: ${String(exhaustive)}`);
    }
  }
}

function ProcessingNotice({ status }: { status: DetailView["status"] }) {
  return (
    <p className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
      This transcript is still processing ({statusLabel(status).toLowerCase()}). Refresh to check for the latest content.
    </p>
  );
}

function FailureNotice({ summary }: { summary: string | null }) {
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
      {summary ?? "Processing could not be completed for this transcript."}
    </p>
  );
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${remainder}s`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

class DetailFetchError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DetailFetchError";
  }
}

async function fetchDetail(args: { workspaceSlug: string; transcriptId: string }): Promise<DetailView> {
  const url = `/api/workspaces/${encodeURIComponent(args.workspaceSlug)}/transcripts/${encodeURIComponent(args.transcriptId)}`;
  let response: Response;
  try {
    response = await fetch(url, { credentials: "same-origin" });
  } catch (err) {
    throw new DetailFetchError("network_error", err instanceof Error ? err.message : "Network request failed");
  }

  const payload = (await response.json().catch(() => null)) as { ok: true; transcript: DetailView } | { ok: false; code: string; message: string } | null;

  if (!payload) {
    throw new DetailFetchError("empty_response", "The server returned an empty response.");
  }
  if (payload.ok === false) {
    throw new DetailFetchError(payload.code, payload.message);
  }
  return payload.transcript;
}
