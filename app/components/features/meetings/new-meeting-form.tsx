"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MeetingSubmissionError, submitMeeting } from "@/lib/client/meeting-submission";

type Props = {
  workspaceSlug: string;
  normalizationPolicy: "optional" | "required";
};

// Submission form for one meeting media file plus optional markdown
// notes. Keeps the multi-step handoff with the server (prepare →
// upload → finalize) inside the `submitMeeting` helper so this
// component only coordinates the React state and surfaces
// progress/errors.
export function NewMeetingForm({ workspaceSlug, normalizationPolicy }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"idle" | "submitting" | "done">("idle");
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || phase === "submitting") return;

    setErrorCode(null);
    setErrorMessage(null);
    setPhase("submitting");
    setProgressMessage("Preparing submission…");

    try {
      const result = await submitMeeting({
        workspaceSlug,
        file,
        ...(notes.trim().length > 0 ? { notesText: notes } : {}),
      });
      setPhase("done");
      setProgressMessage("Submission accepted. Redirecting…");
      router.push(`/w/${encodeURIComponent(workspaceSlug)}/meetings/${encodeURIComponent(result.transcriptId)}`);
    } catch (err) {
      setPhase("idle");
      setProgressMessage(null);
      if (err instanceof MeetingSubmissionError) {
        setErrorCode(err.code);
        setErrorMessage(mapErrorMessage(err.code, err.message, normalizationPolicy));
      } else {
        setErrorCode("unexpected_error");
        setErrorMessage("Something went wrong submitting your meeting. Please try again.");
      }
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    if (errorCode) {
      setErrorCode(null);
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

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function mapErrorMessage(code: string, fallback: string, policy: "optional" | "required"): string {
  switch (code) {
    case "access_denied":
      return "You do not have access to submit meetings in this workspace.";
    case "role_not_authorized":
      return "Your role in this workspace does not allow submitting meetings.";
    case "workspace_archived":
      return "This workspace is archived and cannot accept new submissions.";
    case "media_too_large":
      return "This file is larger than the 500 MB per-submission limit.";
    case "media_unsupported":
      return "Only audio or video files are supported.";
    case "notes_too_long":
      return "Meeting notes exceed the 64 KB limit.";
    case "normalization_required_failed":
      return policy === "required"
        ? "This workspace requires browser-side MP3 conversion, which is not available in your browser. Try Chrome or Edge, or ask an admin to relax the policy."
        : fallback;
    case "media_missing":
      return "The upload did not complete. Please retry.";
    case "plan_token_expired":
      return "The upload session expired. Please start again.";
    case "plan_token_invalid_signature":
    case "plan_token_malformed":
    case "plan_token_user_mismatch":
    case "plan_token_version_mismatch":
      return "The upload session is no longer valid. Please start again.";
    case "upload_failed":
      return "Upload to transient storage failed. Please retry in a moment.";
    default:
      return fallback;
  }
}
