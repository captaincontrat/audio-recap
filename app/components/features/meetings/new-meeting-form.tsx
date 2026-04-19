"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/components/workspace-shell/upload-manager/format";
import { useUploadManagerItems, useUploadManagerStore, useUploadManagerWorkspaceSlug } from "@/components/workspace-shell/upload-manager/provider";
import { isCancellableLocalPhase, type LocalSubmissionPhase } from "@/components/workspace-shell/upload-manager/store";
import { runSubmissionForDraft } from "@/components/workspace-shell/upload-manager/submission-runner";

type Props = {
  normalizationPolicy: "optional" | "required";
};

// Submission form for one meeting media file plus optional markdown
// notes. The form renders inside the workspace shell, so the upload
// manager's store and submission runner are mounted above. We funnel
// the dedicated form's submit through the same draft → run pipeline
// the shell drop overlay and header upload control use; the only
// difference is the dedicated form redirects to the meeting status
// page after `submitMeeting()` returns a transcript id, while the
// other entry points let the user keep working from the tray.
//
// The redirect behavior is a hard requirement of the dedicated page
// (the proposal calls it out explicitly: the page MUST keep its
// existing redirect to the dedicated status page). The shared store
// still tracks the item in the background so the tray reflects the
// upload alongside any other in-flight work.
//
// Because Mediabunny's MP3 conversion can be materially long-running
// on large videos, the form mirrors the tray's explicit local-phase
// surface: we read the in-progress draft's phase + normalization
// progress straight from the store so the user sees "Converting to
// MP3…" with a live percentage instead of a vague "Submitting…".
// The form also exposes a Cancel button while the submission is in
// a cancellable phase (`normalizing` or `preparing`); cancel calls
// `store.cancelInFlight(...)`, which the runner translates into a
// clean removal of the in-flight item rather than a `local_error`
// row.
export function NewMeetingForm({ normalizationPolicy }: Props) {
  const router = useRouter();
  const workspaceSlug = useUploadManagerWorkspaceSlug();
  const store = useUploadManagerStore();
  const items = useUploadManagerItems();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"idle" | "submitting" | "done">("idle");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Re-derive the in-flight item from the store on every render so
  // local-phase transitions and progress ticks bubble into the form's
  // copy without us forwarding every callback through React state.
  const inflightItem = draftId ? (items.find((entry) => entry.id === draftId) ?? null) : null;
  const inflightPhase: LocalSubmissionPhase | null = inflightItem?.localPhase ?? null;
  const inflightProgress = inflightItem?.normalizationProgress ?? null;

  const cancelInFlight = useCallback(() => {
    if (draftId) {
      store.cancelInFlight(draftId);
    }
  }, [draftId, store]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || phase === "submitting") return;

    setErrorMessage(null);
    setPhase("submitting");

    const newDraftId = store.addDraft({ workspaceSlug, file });
    setDraftId(newDraftId);
    if (notes.trim().length > 0) {
      store.updateDraftNotes(newDraftId, notes);
    }
    const draft = store.findItem(newDraftId);
    if (!draft) {
      setPhase("idle");
      setDraftId(null);
      setErrorMessage("Could not stage the upload. Please retry.");
      return;
    }

    // The dedicated form keeps its policy-aware override for
    // `normalization_required_failed` so the message guides the user
    // toward Chrome/Edge or asking an admin to relax the policy. The
    // tray surfaces the shared, policy-agnostic copy from
    // `describeSubmissionErrorCode`; we just inject the override here
    // so the local-error row in the tray matches what we show under
    // the form. The required-policy override is also truthful for
    // both the unavailable path (browser cannot run the conversion)
    // and the failed path (browser tried and the conversion failed)
    // — see `error-messages.ts` for the matching tray copy.
    const result = await runSubmissionForDraft(store, draft, {
      errorMessageOverride: (code, fallback) => {
        if (code === "normalization_required_failed" && normalizationPolicy === "required") {
          return "This workspace requires browser-side MP3 conversion, which did not succeed in your browser. Try Chrome or Edge, or ask an admin to relax the policy.";
        }
        return fallback;
      },
    });

    switch (result.kind) {
      case "submitted":
        setPhase("done");
        setDraftId(null);
        router.push(`/w/${encodeURIComponent(workspaceSlug)}/meetings/${encodeURIComponent(result.transcriptId)}`);
        return;
      case "failed":
        setPhase("idle");
        setDraftId(null);
        setErrorMessage(result.message);
        return;
      case "rejected":
        setPhase("idle");
        setDraftId(null);
        setErrorMessage("Could not stage the upload. Please retry.");
        return;
      case "cancelled":
        // The runner already removed the in-flight item from the
        // store, so the tray returns to a non-error state. We just
        // reset the form so the user can pick another file or close
        // the page without a stale "Submitting…" surface.
        setPhase("idle");
        setDraftId(null);
        return;
      default: {
        const exhaustive: never = result;
        throw new Error(`Unhandled submission result: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    if (errorMessage) {
      setErrorMessage(null);
    }
  }

  const progressMessage = describeProgressMessage(phase, inflightPhase, inflightProgress);
  const cancellable = inflightPhase !== null && isCancellableLocalPhase(inflightPhase);
  // The notes textarea stays editable while the submission is in a
  // cancellable phase (`normalizing` or `preparing`) so the user can
  // refine context during the now-potentially-long Mediabunny
  // conversion. Once we cross into `uploading`/`finalizing` the
  // payload has already left the form, so we lock the field to
  // signal that further edits won't take effect.
  const notesLocked = phase === "submitting" && !cancellable && inflightPhase !== null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="media">Meeting audio or video</Label>
        <Input id="media" type="file" accept="audio/*,video/*" onChange={onFileChange} required disabled={phase === "submitting"} />
        {file ? (
          <p className="text-xs text-muted-foreground">
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">MP3, WAV, M4A, MP4, MOV, and similar formats are supported up to 500 MB.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Meeting notes (optional)</Label>
        <Textarea
          id="notes"
          rows={6}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Add context the recap should use — attendees, decisions, open questions…"
          disabled={notesLocked}
          maxLength={64 * 1024}
        />
        <p className="text-xs text-muted-foreground">Notes are used to improve the recap and are deleted after processing.</p>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Browser-side preparation: </span>
          {normalizationPolicy === "required"
            ? "This workspace requires browser-side MP3 conversion before queueing. Submissions are rejected if your browser cannot perform the conversion."
            : "This workspace prefers browser-side MP3 conversion when available but accepts original files as a fallback."}
        </p>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {progressMessage ? (
        <p data-testid="new-meeting-form-progress" className="text-sm text-muted-foreground">
          {progressMessage}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        {cancellable ? (
          <Button type="button" variant="ghost" onClick={cancelInFlight} data-testid="new-meeting-form-cancel">
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={!file || phase === "submitting"}>
          {phase === "submitting" ? "Submitting…" : "Submit for processing"}
        </Button>
      </div>
    </form>
  );
}

function describeProgressMessage(
  phase: "idle" | "submitting" | "done",
  inflightPhase: LocalSubmissionPhase | null,
  inflightProgress: number | null,
): string | null {
  if (phase === "done") {
    return "Submission accepted. Redirecting…";
  }
  if (phase !== "submitting") {
    return null;
  }
  switch (inflightPhase) {
    case "normalizing":
      if (inflightProgress !== null) {
        const percent = Math.round(inflightProgress * 100);
        return `Converting to MP3 in your browser… (${percent}%)`;
      }
      return "Converting to MP3 in your browser…";
    case "preparing":
      return "Preparing upload…";
    case "uploading":
      return "Uploading…";
    case "finalizing":
      return "Finalizing…";
    case "local_error":
    case "draft":
    case null:
      return "Preparing submission…";
    default: {
      const exhaustive: never = inflightPhase;
      throw new Error(`Unhandled local phase: ${String(exhaustive)}`);
    }
  }
}
