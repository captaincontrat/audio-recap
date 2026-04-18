"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/components/workspace-shell/upload-manager/format";
import { useUploadManagerStore, useUploadManagerWorkspaceSlug } from "@/components/workspace-shell/upload-manager/provider";
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
export function NewMeetingForm({ normalizationPolicy }: Props) {
  const router = useRouter();
  const workspaceSlug = useUploadManagerWorkspaceSlug();
  const store = useUploadManagerStore();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"idle" | "submitting" | "done">("idle");
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || phase === "submitting") return;

    setErrorMessage(null);
    setPhase("submitting");
    setProgressMessage("Preparing submission…");

    const draftId = store.addDraft({ workspaceSlug, file });
    if (notes.trim().length > 0) {
      store.updateDraftNotes(draftId, notes);
    }
    const draft = store.findItem(draftId);
    if (!draft) {
      setPhase("idle");
      setProgressMessage(null);
      setErrorMessage("Could not stage the upload. Please retry.");
      return;
    }

    // The dedicated form keeps its policy-aware override for
    // `normalization_required_failed` so the message guides the user
    // toward Chrome/Edge or asking an admin to relax the policy. The
    // tray surfaces the shared, policy-agnostic copy from
    // `describeSubmissionErrorCode`; we just inject the override here
    // so the local-error row in the tray matches what we show under
    // the form.
    const result = await runSubmissionForDraft(store, draft, {
      errorMessageOverride: (code, fallback) => {
        if (code === "normalization_required_failed" && normalizationPolicy === "required") {
          return "This workspace requires browser-side MP3 conversion, which is not available in your browser. Try Chrome or Edge, or ask an admin to relax the policy.";
        }
        return fallback;
      },
    });

    switch (result.kind) {
      case "submitted":
        setPhase("done");
        setProgressMessage("Submission accepted. Redirecting…");
        router.push(`/w/${encodeURIComponent(workspaceSlug)}/meetings/${encodeURIComponent(result.transcriptId)}`);
        return;
      case "failed":
        setPhase("idle");
        setProgressMessage(null);
        setErrorMessage(result.message);
        return;
      case "rejected":
        setPhase("idle");
        setProgressMessage(null);
        setErrorMessage("Could not stage the upload. Please retry.");
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
          disabled={phase === "submitting"}
          maxLength={64 * 1024}
        />
        <p className="text-xs text-muted-foreground">Notes are used to improve the recap and are deleted after processing.</p>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Browser-side preparation: </span>
          {normalizationPolicy === "required"
            ? "This workspace requires browser-side MP3 conversion before queueing. Submissions are rejected if your browser cannot convert the file."
            : "This workspace prefers browser-side MP3 conversion when available but accepts original files as a fallback."}
        </p>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {progressMessage ? <p className="text-sm text-muted-foreground">{progressMessage}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={!file || phase === "submitting"}>
          {phase === "submitting" ? "Submitting…" : "Submit for processing"}
        </Button>
      </div>
    </form>
  );
}
