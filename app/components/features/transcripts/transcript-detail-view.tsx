"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { TranscriptCurationPanel } from "@/components/features/transcripts/transcript-curation-panel";
import { TranscriptExportPanel } from "@/components/features/transcripts/transcript-export-panel";
import { TranscriptSharePanel, type ShareUpdate } from "@/components/features/transcripts/transcript-share-panel";
import { Button } from "@/components/ui/button";
import { usePushFinalCrumb } from "@/components/workspace-shell/breadcrumb-context";
import { usePublishEditSessionPresence } from "@/components/workspace-shell/edit-session-presence-context";
import { useEditSession } from "@/lib/client/edit-sessions";
import { cn } from "@/lib/utils";

// Mirrors the shape returned by `toDetailView` on the server. Client
// bundle stays free of server-only imports. `add-transcript-curation-controls`
// adds the `customTitle` / `tags` / `isImportant` fields used by the
// curation panel below. `add-public-transcript-sharing` adds the
// nested `share` block the share panel reads/writes.
export type DetailView = {
  id: string;
  workspaceId: string;
  status: "queued" | "preprocessing" | "transcribing" | "generating_recap" | "generating_title" | "finalizing" | "retrying" | "completed" | "failed";
  displayTitle: string;
  customTitle: string | null;
  tags: string[];
  isImportant: boolean;
  transcriptMarkdown: string;
  recapMarkdown: string;
  sourceMediaKind: "audio" | "video";
  originalDurationSec: number | null;
  submittedWithNotes: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failure: { code: string | null; summary: string | null } | null;
  share: {
    isPubliclyShared: boolean;
    // Public URL path (e.g. `/share/<publicShareId>/<shareSecretId>`).
    // `null` whenever sharing is disabled, the workspace has been
    // archived, or the transcript has not completed processing —
    // callers must not invent a path of their own.
    publicSharePath: string | null;
    shareUpdatedAt: string | null;
  };
};

// Server-computed capabilities owned by
// `add-transcript-curation-controls`. The page resolves these from the
// workspace role + creator-attribution data so the client can render
// the correct affordances (disabled/hidden controls, member vs admin
// delete confirmation copy) without a second auth probe.
export type CurationCapabilities = {
  canCurate: boolean;
  canDelete: boolean;
  // When the user can't delete but we want to explain why (e.g. a
  // member attempting to delete a retained record whose creator was
  // deleted). Free-form text; the panel renders it verbatim.
  deleteDisabledReason: string | null;
};

// Share-management capability computed on the server by
// `add-public-transcript-sharing`. The server mirrors this in every
// POST the client issues, so the only thing the UI needs is a single
// boolean: render controls or don't.
export type ShareCapabilities = {
  canManageSharing: boolean;
};

type Props = {
  workspaceSlug: string;
  transcriptId: string;
  initial: DetailView;
  canEditMarkdown: boolean;
  curation: CurationCapabilities;
  sharing: ShareCapabilities;
};

type FetchState = { kind: "idle" } | { kind: "refreshing" } | { kind: "error"; message: string };

// Interactive detail view. The server component owns the not-found /
// archived / access-denied branches, so here we own:
//   - the current snapshot of the detail view
//   - a refresh button that re-fetches the detail payload
//   - the edit-session entry / autosave / exit flow for markdown
//     content when the caller's workspace role allows it
//   - the curation panel: rename, tags, important toggle, and delete
//     (owned by `add-transcript-curation-controls`)
export function TranscriptDetailView({ workspaceSlug, transcriptId, initial, canEditMarkdown, curation, sharing }: Props) {
  const [state, setState] = useState<DetailView>(initial);
  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });
  const editSession = useEditSession({ workspaceSlug, transcriptId, canEdit: canEditMarkdown });

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

  // When an edit session exits (either from an expiry or an explicit
  // user action), re-sync the read-only state with whatever made it to
  // the server. This avoids showing stale read-only copy right after a
  // successful save followed by exit.
  useEffect(() => {
    if (editSession.status.kind === "exited") {
      void refresh();
    }
  }, [editSession.status.kind, refresh]);

  // Same-tab resume on mount: if this page load is actually a refresh
  // of an already-active edit session, the hook finds the stored tab
  // identity and asks the server to resume. The spec gives us up to 10
  // seconds from the last successful autosave to do this; any refusal
  // keeps the user on the read-only view and requires an explicit
  // "Edit" click to start a new session. We guard with a ref so
  // renders triggered by `tryResume` updating the hook state do not
  // kick off a second resume attempt.
  const didAttemptResumeRef = useRef(false);
  const tryResume = editSession.tryResume;
  useEffect(() => {
    if (!canEditMarkdown) return;
    if (didAttemptResumeRef.current) return;
    didAttemptResumeRef.current = true;
    void tryResume();
  }, [canEditMarkdown, tryResume]);

  const isEditing = editSession.status.kind === "editing" || editSession.status.kind === "saving" || editSession.status.kind === "entering";

  // Publish the live display title to the workspace shell's breadcrumb
  // band so the final crumb reads as a human-readable transcript title
  // instead of the opaque transcript id segment. The hook is a no-op
  // when the view is mounted outside the shell (e.g., a future
  // standalone preview), so the detail view stays portable.
  usePushFinalCrumb(state.displayTitle);

  // Tell the shell's `⌘K` listener to back off while the user is in an
  // active edit session. Combined with the palette's active-element
  // check this satisfies the spec rule that the global shortcut must
  // not steal focus from an in-progress edit.
  usePublishEditSessionPresence(isEditing);

  const isProcessing = !(state.status === "completed" || state.status === "failed");
  const editableBlocked = !canEditMarkdown || isProcessing || state.status === "failed";

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{state.displayTitle}</h1>
          <div className="flex items-center gap-2">
            {state.share.isPubliclyShared ? <SharedBadge /> : null}
            {state.isImportant ? <ImportantBadge /> : null}
            <StatusBadge status={state.status} />
          </div>
        </div>
        <DetailMetadata state={state} />
        <TranscriptCurationPanel
          workspaceSlug={workspaceSlug}
          transcriptId={transcriptId}
          snapshot={{ customTitle: state.customTitle, displayTitle: state.displayTitle, tags: state.tags, isImportant: state.isImportant }}
          canCurate={curation.canCurate}
          canDelete={curation.canDelete}
          deleteDisabledReason={curation.deleteDisabledReason}
          onCurationApplied={(updated) => setState((prev) => ({ ...prev, ...updated }))}
        />
        <TranscriptSharePanel
          workspaceSlug={workspaceSlug}
          transcriptId={transcriptId}
          snapshot={state.share}
          canManageSharing={sharing.canManageSharing}
          status={state.status}
          onShareApplied={applyShareUpdate(setState)}
        />
        <TranscriptExportPanel
          displayTitle={state.displayTitle}
          recapMarkdown={state.recapMarkdown}
          transcriptMarkdown={state.transcriptMarkdown}
          canExport={state.status === "completed"}
          exportDisabledReason={state.status === "completed" ? null : exportDisabledReasonFor(state.status)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={refresh} disabled={fetchState.kind === "refreshing" || isEditing}>
            {fetchState.kind === "refreshing" ? "Refreshing…" : "Refresh"}
          </Button>
          <EditControls
            canEdit={canEditMarkdown && !editableBlocked}
            editableBlockedReason={
              !canEditMarkdown
                ? "Only members and admins can edit transcript markdown."
                : isProcessing
                  ? "Editing becomes available once processing completes."
                  : state.status === "failed"
                    ? "Editing is disabled for transcripts that failed processing."
                    : null
            }
            status={editSession.status}
            onEnter={editSession.enter}
            onExit={editSession.exit}
            onDismissError={editSession.dismissError}
          />
          {fetchState.kind === "refreshing" ? <p className="text-xs text-muted-foreground">Fetching latest content…</p> : null}
          {fetchState.kind === "error" ? (
            <p role="alert" className="text-xs text-destructive">
              {fetchState.message}
            </p>
          ) : null}
        </div>
        <SessionBanner status={editSession.status} />
      </header>

      {state.status === "failed" ? (
        <FailureNotice summary={state.failure?.summary ?? null} />
      ) : isProcessing ? (
        <ProcessingNotice status={state.status} />
      ) : null}

      {isEditing && editSession.draft ? (
        <EditableSections draft={editSession.draft} onChange={editSession.setDraft} status={editSession.status} />
      ) : (
        <>
          <DetailSection title="Recap" markdown={state.recapMarkdown} />
          <DetailSection title="Transcript" markdown={state.transcriptMarkdown} variant="transcript" />
        </>
      )}
    </article>
  );
}

function EditControls(props: {
  canEdit: boolean;
  editableBlockedReason: string | null;
  status: ReturnType<typeof useEditSession>["status"];
  onEnter: () => Promise<void>;
  onExit: () => Promise<void>;
  onDismissError: () => void;
}) {
  const isEntering = props.status.kind === "entering";
  const inSession = props.status.kind === "editing" || props.status.kind === "saving";

  if (inSession) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => void props.onExit()}>
        Finish editing
      </Button>
    );
  }

  if (!props.canEdit) {
    return props.editableBlockedReason ? <p className="text-xs text-muted-foreground">{props.editableBlockedReason}</p> : null;
  }

  return (
    <Button type="button" size="sm" onClick={() => void props.onEnter()} disabled={isEntering}>
      {isEntering ? "Opening editor…" : "Edit"}
    </Button>
  );
}

function SessionBanner({ status }: { status: ReturnType<typeof useEditSession>["status"] }) {
  if (status.kind === "error") {
    return (
      <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
        {status.message}
      </p>
    );
  }
  if (status.kind === "exited") {
    return (
      <p
        role="status"
        className={cn(
          "rounded-md border p-2 text-xs",
          status.reason === "expired" || status.reason === "lost"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            : status.reason === "archived"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
              : "border-border/60 bg-muted/30 text-muted-foreground",
        )}
      >
        {exitMessage(status.reason)}
      </p>
    );
  }
  if (status.kind === "editing" || status.kind === "saving") {
    return <p className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">{savedLabel(status)}</p>;
  }
  return null;
}

function savedLabel(status: Extract<ReturnType<typeof useEditSession>["status"], { kind: "editing" | "saving" }>): string {
  if (status.kind === "saving") return "Saving…";
  if (status.pending) return "Changes pending autosave…";
  if (status.savedAt) return `Saved at ${new Date(status.savedAt).toLocaleTimeString()}.`;
  return "Ready to edit. Autosave runs ~1 second after you stop typing.";
}

function exitMessage(reason: "user" | "expired" | "lost" | "archived"): string {
  switch (reason) {
    case "expired":
      return "Your edit session has expired. Re-enter edit mode to continue making changes.";
    case "lost":
      return "Your edit session was lost. Re-enter edit mode to continue making changes.";
    case "archived":
      return "This workspace was archived. Editing is no longer available.";
    case "user":
      return "Edits saved. Editor closed.";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled edit-session exit reason: ${String(exhaustive)}`);
    }
  }
}

function EditableSections(props: {
  draft: { transcriptMarkdown: string; recapMarkdown: string };
  onChange: (next: Partial<{ transcriptMarkdown: string; recapMarkdown: string }>) => void;
  status: ReturnType<typeof useEditSession>["status"];
}) {
  const disabled = props.status.kind === "saving";
  return (
    <>
      <EditableSection title="Recap" value={props.draft.recapMarkdown} disabled={disabled} onChange={(value) => props.onChange({ recapMarkdown: value })} />
      <EditableSection
        title="Transcript"
        value={props.draft.transcriptMarkdown}
        variant="transcript"
        disabled={disabled}
        onChange={(value) => props.onChange({ transcriptMarkdown: value })}
      />
    </>
  );
}

function EditableSection(props: { title: string; value: string; variant?: "recap" | "transcript"; disabled: boolean; onChange: (value: string) => void }) {
  const id = useMemo(() => `edit-${props.title.toLowerCase()}`, [props.title]);
  return (
    <section className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {props.title}
      </label>
      <textarea
        id={id}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        className={cn(
          "w-full resize-y rounded-md border border-border/60 bg-background p-4 font-sans text-sm leading-relaxed text-foreground",
          props.variant === "transcript" ? "min-h-[32rem]" : "min-h-[12rem]",
        )}
      />
    </section>
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
      {state.tags.length > 0 ? (
        <>
          <dt>Tags</dt>
          <dd className="flex flex-wrap gap-1">
            {state.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-sm border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </dd>
        </>
      ) : null}
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

// Small decorative badge rendered next to the transcript title when
// `isImportant` is true. Purely a read-side cue; the curation panel
// toggles the flag. The visible "Important" text is the accessible
// name so screen readers do not need an explicit label.
function ImportantBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
      Important
    </span>
  );
}

// Read-side awareness badge rendered next to the title when public
// sharing is enabled. Visible to every authenticated browser,
// including read-only users who do not see the share-management
// controls. Gives read-only members a clear signal that the
// transcript has a public link without exposing the URL itself.
function SharedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300"
      title="This transcript is publicly shared."
    >
      Shared
    </span>
  );
}

// Applies a share-panel update to the authoritative detail state.
// Kept outside the render function so the closure identity doesn't
// change between renders and the share panel's effect doesn't
// reset spuriously. The share panel only returns the share sub-tree,
// so we merge it into `state.share` rather than into the top-level
// view.
function applyShareUpdate(setState: Dispatch<SetStateAction<DetailView>>) {
  return (update: ShareUpdate) => {
    setState((prev) => ({ ...prev, share: { ...prev.share, ...update } }));
  };
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

// Copy used by the export panel when the transcript is not yet in
// `completed` status. Export is a read action over the canonical
// markdown, so it only becomes available after processing finishes —
// this mirrors the spec's completed-only rule. Failed transcripts get
// a distinct message because the markdown is intentionally empty and
// a download would have nothing to show.
function exportDisabledReasonFor(status: DetailView["status"]): string {
  switch (status) {
    case "completed":
      return "";
    case "failed":
      return "Downloads are disabled for transcripts that failed processing.";
    case "queued":
    case "preprocessing":
    case "transcribing":
    case "generating_recap":
    case "generating_title":
    case "finalizing":
    case "retrying":
      return "Downloads become available once this transcript finishes processing.";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled transcript status: ${String(exhaustive)}`);
    }
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
