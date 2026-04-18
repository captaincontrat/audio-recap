"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// UI owned by `add-transcript-curation-controls`. Renders the
// metadata controls on the transcript detail page:
//
//   - Rename: write a nullable `customTitle` override. Clearing the
//     field falls back to the processing-owned `title` via the
//     `displayTitle` read contract from `add-transcript-management`.
//   - Tags: add/remove tags. Client-side normalization (trim,
//     lowercase, dedupe) mirrors the server rules so the preview
//     reflects what will be persisted.
//   - Important: toggle the flag.
//   - Delete: permanent deletion with explicit confirmation. Copy
//     reflects the workspace role / creator-attribution rules that
//     the server enforces.
//
// Every mutation optimistically applies locally then rolls back if
// the server refuses, so the visible state never drifts past the
// authoritative record.

// Keep these in lockstep with `validation.ts` on the server. The
// server is still the authority; these are purely for client-side
// affordances (trimming, preview, disabled "Save" state).
const MAX_CUSTOM_TITLE_LENGTH = 200;
const MAX_TAG_COUNT = 20;
const MAX_TAG_LENGTH = 32;

export type CurationSnapshot = {
  customTitle: string | null;
  displayTitle: string;
  tags: string[];
  isImportant: boolean;
};

// Subset of fields the panel can update. The parent merges these
// into the full `DetailView` it owns.
export type CurationUpdate = {
  customTitle: string | null;
  displayTitle: string;
  tags: string[];
  isImportant: boolean;
};

type Props = {
  workspaceSlug: string;
  transcriptId: string;
  snapshot: CurationSnapshot;
  canCurate: boolean;
  canDelete: boolean;
  deleteDisabledReason: string | null;
  onCurationApplied: (update: CurationUpdate) => void;
};

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

export function TranscriptCurationPanel({ workspaceSlug, transcriptId, snapshot, canCurate, canDelete, deleteDisabledReason, onCurationApplied }: Props) {
  if (!canCurate && !canDelete) {
    return null;
  }
  return (
    <section className="flex flex-col gap-4 rounded-md border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Curation</h2>
      </div>
      {canCurate ? <RenameControl workspaceSlug={workspaceSlug} transcriptId={transcriptId} snapshot={snapshot} onApplied={onCurationApplied} /> : null}
      {canCurate ? <TagControl workspaceSlug={workspaceSlug} transcriptId={transcriptId} snapshot={snapshot} onApplied={onCurationApplied} /> : null}
      {canCurate ? <ImportantToggle workspaceSlug={workspaceSlug} transcriptId={transcriptId} snapshot={snapshot} onApplied={onCurationApplied} /> : null}
      <DeleteControl
        workspaceSlug={workspaceSlug}
        transcriptId={transcriptId}
        snapshot={snapshot}
        canDelete={canDelete}
        deleteDisabledReason={deleteDisabledReason}
      />
    </section>
  );
}

function RenameControl({
  workspaceSlug,
  transcriptId,
  snapshot,
  onApplied,
}: {
  workspaceSlug: string;
  transcriptId: string;
  snapshot: CurationSnapshot;
  onApplied: (update: CurationUpdate) => void;
}) {
  // Track the current custom title override locally. The textbox is
  // always editable; an empty string is interpreted as "clear the
  // override" and relies on the server to fall back to the
  // processing-owned `title`.
  const [value, setValue] = useState<string>(snapshot.customTitle ?? "");
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    setValue(snapshot.customTitle ?? "");
  }, [snapshot.customTitle]);

  const trimmed = value.trim();
  const isOverLength = trimmed.length > MAX_CUSTOM_TITLE_LENGTH;
  const currentOverride = snapshot.customTitle ?? "";
  const isDirty = trimmed !== currentOverride.trim();
  const nextCustomTitle: string | null = trimmed.length === 0 ? null : trimmed;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isOverLength || !isDirty || state.kind === "saving") return;
    setState({ kind: "saving" });
    try {
      const next = await patchCuration({ workspaceSlug, transcriptId, patch: { customTitle: nextCustomTitle } });
      onApplied(next);
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof CurationError ? err.message : "Could not update the title." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Label htmlFor="curation-rename">Title override</Label>
      <Input
        id="curation-rename"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Use the processing-owned title"
        maxLength={MAX_CUSTOM_TITLE_LENGTH + 10}
        disabled={state.kind === "saving"}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Currently showing: <span className="font-medium text-foreground">{snapshot.displayTitle}</span>
        </span>
        <span>
          {trimmed.length}/{MAX_CUSTOM_TITLE_LENGTH}
        </span>
      </div>
      {isOverLength ? (
        <p role="alert" className="text-xs text-destructive">
          Title must be {MAX_CUSTOM_TITLE_LENGTH} characters or fewer.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!isDirty || isOverLength || state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : trimmed.length === 0 ? "Clear override" : "Save title"}
        </Button>
        {snapshot.customTitle !== null ? (
          <span className="text-xs text-muted-foreground">Override active. Clear the field to fall back to the processing title.</span>
        ) : (
          <span className="text-xs text-muted-foreground">No override. The processing-owned title is used.</span>
        )}
      </div>
    </form>
  );
}

function TagControl({
  workspaceSlug,
  transcriptId,
  snapshot,
  onApplied,
}: {
  workspaceSlug: string;
  transcriptId: string;
  snapshot: CurationSnapshot;
  onApplied: (update: CurationUpdate) => void;
}) {
  // Local "draft" tag list. The user adds/removes tags here; the save
  // button persists the whole set. We keep the draft in sync with the
  // authoritative snapshot whenever it changes externally (e.g. after
  // a refresh).
  const [draft, setDraft] = useState<string[]>(snapshot.tags);
  const [input, setInput] = useState<string>("");
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    setDraft(snapshot.tags);
  }, [snapshot.tags]);

  const normalizedDraft = useMemo(() => normalizeTagList(draft), [draft]);
  const snapshotNormalized = useMemo(() => normalizeTagList(snapshot.tags), [snapshot.tags]);
  const isDirty = !sameSet(normalizedDraft, snapshotNormalized);

  function addTag(raw: string) {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) return;
    if (normalized.length > MAX_TAG_LENGTH) {
      setState({ kind: "error", message: `Each tag must be ${MAX_TAG_LENGTH} characters or fewer.` });
      return;
    }
    if (draft.some((tag) => tag.toLowerCase() === normalized)) {
      // Duplicate (case-insensitive) — keep the current draft.
      setInput("");
      return;
    }
    if (draft.length >= MAX_TAG_COUNT) {
      setState({ kind: "error", message: `A transcript can carry at most ${MAX_TAG_COUNT} tags.` });
      return;
    }
    setDraft([...draft, normalized]);
    setInput("");
    setState({ kind: "idle" });
  }

  function removeTag(tag: string) {
    setDraft(draft.filter((entry) => entry !== tag));
    setState({ kind: "idle" });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(input);
    } else if (event.key === "Backspace" && input.length === 0 && draft.length > 0) {
      // Convenience: pop the last chip when the input is empty.
      removeTag(draft[draft.length - 1]);
    }
  }

  async function handleSave() {
    if (!isDirty || state.kind === "saving") return;
    setState({ kind: "saving" });
    try {
      const next = await patchCuration({ workspaceSlug, transcriptId, patch: { tags: draft } });
      onApplied(next);
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof CurationError ? err.message : "Could not update the tags." });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="curation-tags">Tags</Label>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-background p-2">
        {draft.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-sm px-0.5 text-muted-foreground hover:bg-muted-foreground/10"
              aria-label={`Remove tag ${tag}`}
              disabled={state.kind === "saving"}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="curation-tags"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={draft.length === 0 ? "Add a tag (press Enter)" : ""}
          className={cn("min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none")}
          disabled={state.kind === "saving" || draft.length >= MAX_TAG_COUNT}
          maxLength={MAX_TAG_LENGTH + 10}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {draft.length}/{MAX_TAG_COUNT} tags
        </span>
        <span>Press Enter or comma to add. Duplicates are merged automatically.</span>
      </div>
      {state.kind === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={!isDirty || state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : "Save tags"}
        </Button>
      </div>
    </div>
  );
}

function ImportantToggle({
  workspaceSlug,
  transcriptId,
  snapshot,
  onApplied,
}: {
  workspaceSlug: string;
  transcriptId: string;
  snapshot: CurationSnapshot;
  onApplied: (update: CurationUpdate) => void;
}) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  async function handleToggle() {
    if (state.kind === "saving") return;
    setState({ kind: "saving" });
    try {
      const next = await patchCuration({ workspaceSlug, transcriptId, patch: { isImportant: !snapshot.isImportant } });
      onApplied(next);
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof CurationError ? err.message : "Could not update the important marker." });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Important marker</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={snapshot.isImportant ? "secondary" : "outline"} onClick={handleToggle} disabled={state.kind === "saving"}>
          {snapshot.isImportant ? "Unmark important" : "Mark as important"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {snapshot.isImportant
            ? "This transcript is flagged as important and surfaces in important-first library sort and important-state filter."
            : "Important records surface ahead of other transcripts in the workspace library."}
        </span>
      </div>
      {state.kind === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

type DeleteState = { kind: "idle" } | { kind: "confirming" } | { kind: "deleting" } | { kind: "error"; message: string };

function DeleteControl({
  workspaceSlug,
  transcriptId,
  snapshot,
  canDelete,
  deleteDisabledReason,
}: {
  workspaceSlug: string;
  transcriptId: string;
  snapshot: CurationSnapshot;
  canDelete: boolean;
  deleteDisabledReason: string | null;
}) {
  const [state, setState] = useState<DeleteState>({ kind: "idle" });
  const router = useRouter();
  // Tracks whether the component is still mounted so async callbacks
  // don't set state on a gone component (e.g. after a successful
  // delete we replace the page, and the user can navigate away
  // in-flight).
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleConfirm() {
    if (state.kind === "deleting") return;
    setState({ kind: "deleting" });
    try {
      await deleteTranscript({ workspaceSlug, transcriptId });
      router.replace(`/w/${encodeURIComponent(workspaceSlug)}/transcripts`);
      router.refresh();
    } catch (err) {
      if (!mountedRef.current) return;
      setState({ kind: "error", message: err instanceof CurationError ? err.message : "Could not delete the transcript." });
    }
  }

  if (!canDelete) {
    if (!deleteDisabledReason) return null;
    return (
      <div className="flex flex-col gap-1">
        <Label>Delete transcript</Label>
        <p className="text-xs text-muted-foreground">{deleteDisabledReason}</p>
      </div>
    );
  }

  const confirming = state.kind === "confirming";
  const deleting = state.kind === "deleting";

  return (
    <div className="flex flex-col gap-2">
      <Label>Delete transcript</Label>
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <p className="text-destructive">
            Delete "<span className="font-medium">{snapshot.displayTitle}</span>" permanently? This cannot be undone.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="destructive" onClick={handleConfirm} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete permanently"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setState({ kind: "idle" })} disabled={deleting}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="destructive" onClick={() => setState({ kind: "confirming" })}>
            Delete transcript
          </Button>
          <span className="text-xs text-muted-foreground">You'll be asked to confirm before deletion happens.</span>
        </div>
      )}
      {state.kind === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function normalizeTagList(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

class CurationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CurationError";
  }
}

type PatchBody = {
  customTitle?: string | null;
  tags?: string[];
  isImportant?: boolean;
};

type PatchResponse = {
  ok: true;
  transcript: {
    customTitle: string | null;
    displayTitle: string;
    tags: string[];
    isImportant: boolean;
  };
};

async function patchCuration(args: { workspaceSlug: string; transcriptId: string; patch: PatchBody }): Promise<CurationUpdate> {
  const url = `/api/workspaces/${encodeURIComponent(args.workspaceSlug)}/transcripts/${encodeURIComponent(args.transcriptId)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(args.patch),
    });
  } catch (err) {
    throw new CurationError("network_error", err instanceof Error ? err.message : "Network request failed");
  }
  const payload = (await response.json().catch(() => null)) as PatchResponse | { ok: false; code: string; message: string } | null;
  if (!payload) {
    throw new CurationError("empty_response", "The server returned an empty response.");
  }
  if (payload.ok === false) {
    throw new CurationError(payload.code, payload.message);
  }
  return {
    customTitle: payload.transcript.customTitle,
    displayTitle: payload.transcript.displayTitle,
    tags: payload.transcript.tags,
    isImportant: payload.transcript.isImportant,
  };
}

async function deleteTranscript(args: { workspaceSlug: string; transcriptId: string }): Promise<void> {
  const url = `/api/workspaces/${encodeURIComponent(args.workspaceSlug)}/transcripts/${encodeURIComponent(args.transcriptId)}`;
  let response: Response;
  try {
    response = await fetch(url, { method: "DELETE", credentials: "same-origin" });
  } catch (err) {
    throw new CurationError("network_error", err instanceof Error ? err.message : "Network request failed");
  }
  if (response.status === 204) return;
  const payload = (await response.json().catch(() => null)) as { ok: true } | { ok: false; code: string; message: string } | null;
  if (!payload) {
    throw new CurationError("empty_response", "The server returned an empty response.");
  }
  if (payload.ok === false) {
    throw new CurationError(payload.code, payload.message);
  }
}
