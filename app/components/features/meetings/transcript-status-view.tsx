"use client";

import { useEffect, useState } from "react";

import { usePushFinalCrumb } from "@/components/workspace-shell/breadcrumb-context";
import { cn } from "@/lib/utils";

type Status = "queued" | "preprocessing" | "transcribing" | "generating_recap" | "generating_title" | "finalizing" | "retrying" | "completed" | "failed";

type TranscriptView = {
  id: string;
  workspaceId: string;
  status: Status;
  sourceMediaKind: "audio" | "video";
  submittedWithNotes: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  title: string | null;
  hasRecap: boolean;
  failure: { code: string | null; summary: string | null } | null;
};

type Props = {
  workspaceSlug: string;
  transcriptId: string;
  initial: TranscriptView;
};

const TERMINAL: Status[] = ["completed", "failed"];
const POLL_INTERVAL_MS = 4_000;

export function TranscriptStatusView({ workspaceSlug, transcriptId, initial }: Props) {
  const [state, setState] = useState<TranscriptView>(initial);
  const [pollError, setPollError] = useState<string | null>(null);

  // Publish the meeting title to the workspace shell's breadcrumb band
  // so the final crumb reads as a human-readable label as soon as the
  // worker has one. The fallback is "Meeting status" so the band is
  // never just a shortened transcript id while the worker is still
  // titling. The hook is a no-op outside the shell.
  usePushFinalCrumb(state.title && state.title.trim().length > 0 ? state.title : "Meeting status");

  useEffect(() => {
    if (TERMINAL.includes(state.status)) {
      return;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceSlug)}/meetings/${encodeURIComponent(transcriptId)}/status`, {
          credentials: "same-origin",
        });
        const payload = (await response.json().catch(() => null)) as { ok: true; transcript: TranscriptView } | { ok: false; message: string } | null;
        if (cancelled) return;
        if (!payload) {
          setPollError("Could not read status from the server.");
          return;
        }
        if (payload.ok === false) {
          setPollError(payload.message);
          return;
        }
        setPollError(null);
        setState(payload.transcript);
      } catch (err) {
        if (cancelled) return;
        setPollError(err instanceof Error ? err.message : "Unexpected polling error.");
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state.status, workspaceSlug, transcriptId]);

  return (
    <section className="flex flex-col gap-4">
      <StatusHeadline state={state} />
      <StagesList status={state.status} />
      {pollError ? (
        <p role="alert" className="text-xs text-destructive">
          {pollError}
        </p>
      ) : null}
    </section>
  );
}

function StatusHeadline({ state }: { state: TranscriptView }) {
  switch (state.status) {
    case "queued":
      return <Panel tone="info" title="Queued" description="Your meeting is waiting for a worker to pick it up." />;
    case "preprocessing":
      return <Panel tone="info" title="Preprocessing" description="Preparing the audio for transcription." />;
    case "transcribing":
      return <Panel tone="info" title="Transcribing" description="Generating the diarized transcript." />;
    case "generating_recap":
      return <Panel tone="info" title="Writing the recap" description="Summarizing key topics and decisions." />;
    case "generating_title":
      return <Panel tone="info" title="Titling" description="Generating a descriptive title for the meeting." />;
    case "finalizing":
      return <Panel tone="info" title="Finalizing" description="Persisting content and cleaning up transient inputs." />;
    case "retrying":
      return (
        <Panel tone="warning" title="Retrying" description={state.failure?.summary ?? "A transient error occurred; the worker will retry automatically."} />
      );
    case "completed":
      return (
        <Panel
          tone="success"
          title={state.title ? state.title : "Completed"}
          description={
            state.hasRecap
              ? "Processing finished. The recap and transcript are ready."
              : "Processing finished. Transcript content is available in the workspace library (coming soon)."
          }
        />
      );
    case "failed":
      return <Panel tone="destructive" title="Failed" description={state.failure?.summary ?? "Processing could not be completed."} />;
    default: {
      const exhaustive: never = state.status;
      throw new Error(`Unhandled status: ${String(exhaustive)}`);
    }
  }
}

function StagesList({ status }: { status: Status }) {
  const stages: Array<{ key: Status; label: string }> = [
    { key: "queued", label: "Queued" },
    { key: "preprocessing", label: "Preprocessing" },
    { key: "transcribing", label: "Transcribing" },
    { key: "generating_recap", label: "Writing recap" },
    { key: "generating_title", label: "Titling" },
    { key: "finalizing", label: "Finalizing" },
  ];
  const currentIndex = stages.findIndex((stage) => stage.key === status);

  return (
    <ol className="grid gap-1 text-xs">
      {stages.map((stage, index) => {
        const isDone = status === "completed" || (currentIndex > -1 && index < currentIndex);
        const isCurrent = currentIndex === index && status !== "completed" && status !== "failed";
        return (
          <li key={stage.key} className="flex items-center gap-2 text-muted-foreground" data-state={isDone ? "done" : isCurrent ? "current" : "pending"}>
            <span
              aria-hidden="true"
              className={cn("inline-block size-2 rounded-full", isDone ? "bg-primary" : isCurrent ? "bg-primary/50 animate-pulse" : "bg-border")}
            />
            <span className={isCurrent ? "font-medium text-foreground" : undefined}>{stage.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Panel({ tone, title, description }: { tone: "info" | "warning" | "success" | "destructive"; title: string; description: string }) {
  const toneClass = {
    info: "border-border/70 bg-muted/30",
    warning: "border-amber-500/40 bg-amber-500/5",
    success: "border-emerald-500/40 bg-emerald-500/5",
    destructive: "border-destructive/40 bg-destructive/5",
  }[tone];

  return (
    <div className={cn("flex flex-col gap-1 rounded-md border p-4", toneClass)}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
