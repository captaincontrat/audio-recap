"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Public-sharing management panel owned by
// `add-public-transcript-sharing`. Rendered alongside the curation
// panel on the authenticated transcript detail page. The server
// enforces the actual authorization rules — the panel simply hides
// controls for workspace users who cannot manage sharing and
// disables actions for states the server would refuse (e.g.
// enabling a still-processing transcript).
//
// Three actions are exposed through a single POST endpoint that
// takes `{ action: "enable" | "disable" | "rotate" }`:
//
//   - Enable creates or reuses the stable publicShareId, mints a
//     fresh shareSecretId, and returns the updated detail view.
//   - Disable flips the share off and clears the active secret.
//   - Rotate keeps the public handle stable but replaces the secret
//     so any previously shared URL stops resolving immediately.
//
// The rendered share URL is derived from the `publicSharePath`
// returned in the detail projection. We combine it with
// `window.location.origin` at copy time so the copied link is a
// fully-qualified URL. Only members and admins reach this panel;
// the parent gates the render on `canManageSharing`.

export type ShareSnapshot = {
  isPubliclyShared: boolean;
  publicSharePath: string | null;
  shareUpdatedAt: string | null;
};

export type ShareUpdate = ShareSnapshot;

type Props = {
  workspaceSlug: string;
  transcriptId: string;
  snapshot: ShareSnapshot;
  // The panel only renders when the caller's workspace role permits
  // share management (member/admin in an active workspace). The
  // parent page decides this from the same `canManagePublicSharing`
  // predicate the server enforces, so UI state never drifts from
  // authoritative authorization.
  canManageSharing: boolean;
  // Transcript status is needed to decide whether the "Enable"
  // action should be offered. The server refuses enables for any
  // status other than `completed`; we mirror that here so the
  // control is disabled with explanatory copy rather than firing a
  // request the server will reject.
  status: "queued" | "preprocessing" | "transcribing" | "generating_recap" | "generating_title" | "finalizing" | "retrying" | "completed" | "failed";
  onShareApplied: (update: ShareUpdate) => void;
};

type ActionState = { kind: "idle" } | { kind: "working"; action: "enable" | "disable" | "rotate" } | { kind: "error"; message: string };

type CopyState = { kind: "idle" } | { kind: "copied" } | { kind: "error" };

export function TranscriptSharePanel({ workspaceSlug, transcriptId, snapshot, canManageSharing, status, onShareApplied }: Props) {
  if (!canManageSharing) {
    // Per spec: `read_only` transcript browsers do not receive
    // share-management controls. Rendering nothing keeps the
    // detail layout tidy; the caller can add a "Shared" badge in
    // the header if it wants to signal state to read-only users.
    return null;
  }
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Public sharing</h2>
        <ShareStateBadge isPubliclyShared={snapshot.isPubliclyShared} />
      </div>
      <ShareControls workspaceSlug={workspaceSlug} transcriptId={transcriptId} snapshot={snapshot} status={status} onShareApplied={onShareApplied} />
    </section>
  );
}

function ShareStateBadge({ isPubliclyShared }: { isPubliclyShared: boolean }) {
  if (isPubliclyShared) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
        Shared
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Private
    </span>
  );
}

function ShareControls({
  workspaceSlug,
  transcriptId,
  snapshot,
  status,
  onShareApplied,
}: {
  workspaceSlug: string;
  transcriptId: string;
  snapshot: ShareSnapshot;
  status: Props["status"];
  onShareApplied: (update: ShareUpdate) => void;
}) {
  const [state, setState] = useState<ActionState>({ kind: "idle" });
  const [copyState, setCopyState] = useState<CopyState>({ kind: "idle" });

  useEffect(() => {
    // Reset the "copied" confirmation whenever the underlying share
    // link changes so the affirmative feedback cannot outlive the
    // link it was attached to.
    setCopyState({ kind: "idle" });
  }, [snapshot.publicSharePath]);

  const isCompleted = status === "completed";
  const isWorking = state.kind === "working";

  async function runAction(action: "enable" | "disable" | "rotate") {
    if (isWorking) return;
    setState({ kind: "working", action });
    try {
      const next = await postShareAction({ workspaceSlug, transcriptId, action });
      onShareApplied(next);
      setState({ kind: "idle" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof ShareActionError ? err.message : "Could not update public sharing." });
    }
  }

  async function handleCopy() {
    if (!snapshot.publicSharePath) return;
    const fullUrl = fullShareUrl(snapshot.publicSharePath);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        throw new Error("Clipboard API is not available in this browser.");
      }
      setCopyState({ kind: "copied" });
    } catch {
      setCopyState({ kind: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {snapshot.isPubliclyShared && snapshot.publicSharePath ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="share-public-url">Public link</Label>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <input
              id="share-public-url"
              readOnly
              value={fullShareUrl(snapshot.publicSharePath)}
              onFocus={(event) => event.currentTarget.select()}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
            <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
              {copyState.kind === "copied" ? "Copied" : copyState.kind === "error" ? "Copy failed" : "Copy link"}
            </Button>
          </div>
          {snapshot.shareUpdatedAt ? <p className="text-xs text-muted-foreground">Last updated {new Date(snapshot.shareUpdatedAt).toLocaleString()}.</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {snapshot.isPubliclyShared ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => void runAction("rotate")} disabled={isWorking}>
              {state.kind === "working" && state.action === "rotate" ? "Rotating…" : "Rotate link"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void runAction("disable")} disabled={isWorking}>
              {state.kind === "working" && state.action === "disable" ? "Disabling…" : "Disable sharing"}
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" onClick={() => void runAction("enable")} disabled={isWorking || !isCompleted}>
            {state.kind === "working" && state.action === "enable" ? "Enabling…" : "Enable public sharing"}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {snapshot.isPubliclyShared
          ? "Anyone with this link can read the current title, recap, and transcript. Rotating invalidates the prior link immediately; disabling stops all access."
          : isCompleted
            ? "Enable public sharing to generate a read-only link for visitors outside this workspace. The link updates whenever the transcript changes."
            : "Sharing becomes available once this transcript finishes processing."}
      </p>

      {state.kind === "error" ? (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function fullShareUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

class ShareActionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ShareActionError";
  }
}

type ShareActionResponse =
  | {
      ok: true;
      transcript: {
        share: { isPubliclyShared: boolean; publicSharePath: string | null; shareUpdatedAt: string | null };
      };
    }
  | { ok: false; code: string; message: string };

async function postShareAction(args: { workspaceSlug: string; transcriptId: string; action: "enable" | "disable" | "rotate" }): Promise<ShareUpdate> {
  const url = `/api/workspaces/${encodeURIComponent(args.workspaceSlug)}/transcripts/${encodeURIComponent(args.transcriptId)}/share`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: args.action }),
    });
  } catch (err) {
    throw new ShareActionError("network_error", err instanceof Error ? err.message : "Network request failed");
  }
  const payload = (await response.json().catch(() => null)) as ShareActionResponse | null;
  if (!payload) {
    throw new ShareActionError("empty_response", "The server returned an empty response.");
  }
  if (payload.ok === false) {
    throw new ShareActionError(payload.code, payload.message);
  }
  return toShareUpdate(payload.transcript.share);
}

// Narrow the network payload to the `ShareUpdate` shape so callers
// cannot drift with future fields the server might return on the
// full detail projection. Kept as a plain function so call sites
// read as "this is the update I apply".
function toShareUpdate(share: { isPubliclyShared: boolean; publicSharePath: string | null; shareUpdatedAt: string | null }): ShareUpdate {
  return {
    isPubliclyShared: share.isPubliclyShared,
    publicSharePath: share.publicSharePath,
    shareUpdatedAt: share.shareUpdatedAt,
  };
}
