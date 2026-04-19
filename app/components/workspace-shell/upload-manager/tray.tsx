"use client";

// Persistent bottom-right upload manager. Listens to the workspace-
// scoped store and renders one card per visible item. The tray:
//
//   - is workspace-scoped (the provider above already filters items
//     by `workspaceSlug`),
//   - holds drafts (drop-then-confirm hand-off), in-flight local
//     phases, and the server transcript-processing phases through to
//     terminal,
//   - collapses into a single summary row when the queue exceeds a
//     small visible count,
//   - lets the user dismiss terminal items (completed / failed) and
//     `local_error` items; in-flight items stay pinned,
//   - links every non-draft item to the dedicated transcript status
//     page so the user can drill in for full detail.
//
// Composition follows the design's `card` chrome: `CardHeader` for
// filename + lifecycle badge, `CardContent` for progress + notes,
// `CardFooter` for confirm/cancel/dismiss.

import { RiArrowDownSLine, RiArrowUpSLine, RiCheckLine, RiCloseLine, RiErrorWarningLine, RiExternalLinkLine, RiUploadCloud2Line } from "@remixicon/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { formatBytes } from "./format";
import { useUploadManagerItems, useUploadManagerStore, useUploadManagerWorkspaceSlug } from "./provider";
import { isCancellableLocalPhase, isTerminalServerPhase, type LocalSubmissionPhase, type ServerProcessingPhase, type UploadManagerItem } from "./store";
import { runSubmissionForDraft } from "./submission-runner";

// Threshold above which the tray header replaces the verbose item
// stack with a one-line summary. The user can still expand it. The
// number is tuned so a typical "2-3 in-flight" queue stays open and
// only "lots of work" collapses by default.
const COLLAPSE_TO_SUMMARY_THRESHOLD = 4;

export function UploadManagerTray(): React.ReactElement | null {
  const items = useUploadManagerItems();
  // Most-recently-touched first feels right when most of the
  // activity is the user's current focus. We sort descending by the
  // store's `updatedAt` so a freshly dropped draft, a newly
  // transitioned phase, or a newly arrived server status all bubble
  // to the top without re-keying React.
  const ordered = useMemo(() => [...items].sort((a, b) => b.updatedAt - a.updatedAt), [items]);
  // Three states: `null` means "follow the collapsedByDefault rule"
  // (the spec wants the tray to collapse when the queue grows past
  // the visible threshold); `true`/`false` capture the user's last
  // explicit toggle so a manual choice keeps sticking even when the
  // queue keeps growing.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  if (ordered.length === 0) return null;

  const summary = summarize(ordered);
  const collapsedByDefault = ordered.length > COLLAPSE_TO_SUMMARY_THRESHOLD;
  const isOpen = userOpen ?? !collapsedByDefault;

  return (
    <div data-testid="workspace-shell-upload-manager" className="pointer-events-auto fixed right-4 bottom-4 z-40 flex w-96 max-w-[calc(100vw-2rem)] flex-col">
      <Collapsible open={isOpen} onOpenChange={setUserOpen}>
        <Card size="sm" className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
              data-testid="workspace-shell-upload-manager-toggle"
            >
              <span className="flex min-w-0 items-center gap-2">
                <RiUploadCloud2Line aria-hidden="true" className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Uploads</span>
                <Badge variant="secondary" data-testid="workspace-shell-upload-manager-count">
                  {ordered.length}
                </Badge>
                <span className="truncate text-xs text-muted-foreground">{summary}</span>
              </span>
              {isOpen ? (
                <RiArrowDownSLine aria-hidden="true" className="size-4 text-muted-foreground" />
              ) : (
                <RiArrowUpSLine aria-hidden="true" className="size-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent data-testid="workspace-shell-upload-manager-list">
            <ScrollArea className="max-h-[60vh]">
              <ul className="flex flex-col gap-2 border-t border-border/60 p-2">
                {ordered.map((item) => (
                  <li key={item.id}>
                    <UploadManagerItemCard item={item} />
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

// One card per item. Branches on the item's effective phase: if a
// server phase is set, that takes priority; otherwise the local
// submission phase drives the layout. Draft is its own special case
// — it is the confirmation surface — and lives at the top of this
// branch order so it never gets confused with a `preparing` row.
function UploadManagerItemCard({ item }: { item: UploadManagerItem }): React.ReactElement {
  if (item.localPhase === "draft") {
    return <DraftCard item={item} />;
  }
  if (item.localPhase === "local_error") {
    return <LocalErrorCard item={item} />;
  }
  if (item.localPhase !== null) {
    return <LocalPhaseCard item={item} phase={item.localPhase} />;
  }
  if (item.serverPhase !== null && item.transcriptId) {
    return <ServerPhaseCard item={item} transcriptId={item.transcriptId} phase={item.serverPhase} />;
  }
  // Defensive: a malformed item with neither phase. Render nothing
  // rather than throw — this should not be reachable in practice.
  return <></>;
}

function DraftCard({ item }: { item: UploadManagerItem }): React.ReactElement {
  const store = useUploadManagerStore();
  const [pendingConfirm, setPendingConfirm] = useState(false);

  function onCancel() {
    store.cancelDraft(item.id);
  }

  async function onConfirm() {
    if (pendingConfirm) return;
    setPendingConfirm(true);
    try {
      await runSubmissionForDraft(store, item);
    } finally {
      setPendingConfirm(false);
    }
  }

  return (
    <Card size="sm" data-testid="workspace-shell-upload-item" data-item-id={item.id} data-phase="draft">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          <PhaseBadge label="Ready to upload" tone="secondary" />
        </div>
        <p className="text-xs text-muted-foreground">{formatBytes(item.fileSize)}</p>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${item.id}-notes`}>Notes (optional)</FieldLabel>
            <Textarea
              id={`${item.id}-notes`}
              rows={3}
              value={item.notes}
              maxLength={64 * 1024}
              placeholder="Attendees, decisions, open questions…"
              disabled={pendingConfirm}
              onChange={(event) => store.updateDraftNotes(item.id, event.target.value)}
            />
            <FieldDescription>Notes are used to improve the recap and are deleted after processing.</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pendingConfirm} data-testid="workspace-shell-upload-item-cancel">
          <RiCloseLine data-icon="inline-start" />
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={onConfirm} disabled={pendingConfirm} data-testid="workspace-shell-upload-item-confirm">
          {pendingConfirm ? <Spinner data-icon="inline-start" /> : <RiCheckLine data-icon="inline-start" />}
          {pendingConfirm ? "Submitting…" : "Confirm upload"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function LocalErrorCard({ item }: { item: UploadManagerItem }): React.ReactElement {
  const store = useUploadManagerStore();
  return (
    <Card size="sm" data-testid="workspace-shell-upload-item" data-item-id={item.id} data-phase="local_error">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          <PhaseBadge label="Failed" tone="destructive" icon={<RiErrorWarningLine aria-hidden="true" className="size-2.5!" />} />
        </div>
        <p className="text-xs text-muted-foreground">{formatBytes(item.fileSize)}</p>
      </CardHeader>
      <CardContent>
        <p role="alert" className="text-xs text-destructive">
          {item.errorMessage ?? "Submission failed."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Drag the file in again or use the upload control to retry.</p>
      </CardContent>
      <CardFooter className="justify-end">
        <DismissButton itemId={item.id} onDismiss={() => store.dismiss(item.id)} />
      </CardFooter>
    </Card>
  );
}

function LocalPhaseCard({ item, phase }: { item: UploadManagerItem; phase: Exclude<LocalSubmissionPhase, "draft" | "local_error"> }): React.ReactElement {
  const store = useUploadManagerStore();
  const cancellable = isCancellableLocalPhase(phase);
  const phaseLabel = describeLocalPhase(phase);
  // For `normalizing`, prefer the determinate Mediabunny progress
  // when we have it so long video conversions show visible movement
  // instead of a static spinner. Until the first tick lands we still
  // show the bar at the phase's coarse value so the layout stays
  // stable rather than flashing in and out.
  const progressValue = phase === "normalizing" && item.normalizationProgress !== null ? Math.round(item.normalizationProgress * 100) : localProgressFor(phase);
  return (
    <Card size="sm" data-testid="workspace-shell-upload-item" data-item-id={item.id} data-phase={phase}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          <PhaseBadge label={phaseLabel} tone="secondary" icon={<Spinner className="size-2.5!" />} />
        </div>
        <p className="text-xs text-muted-foreground">{formatBytes(item.fileSize)}</p>
      </CardHeader>
      <CardContent>
        <Progress value={progressValue} aria-label={`Upload progress: ${phaseLabel}`} />
      </CardContent>
      {cancellable ? (
        <CardFooter className="justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => store.cancelInFlight(item.id)}
            data-testid="workspace-shell-upload-item-cancel-inflight"
          >
            <RiCloseLine data-icon="inline-start" />
            Cancel
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function ServerPhaseCard({ item, transcriptId, phase }: { item: UploadManagerItem; transcriptId: string; phase: ServerProcessingPhase }): React.ReactElement {
  const store = useUploadManagerStore();
  const workspaceSlug = useUploadManagerWorkspaceSlug();
  const isTerminal = isTerminalServerPhase(phase);
  const tone: "default" | "secondary" | "destructive" = phase === "completed" ? "default" : phase === "failed" ? "destructive" : "secondary";
  const label = describeServerPhase(phase);
  const headline = item.title?.trim() && item.title.trim().length > 0 ? item.title : item.fileName;

  return (
    <Card size="sm" data-testid="workspace-shell-upload-item" data-item-id={item.id} data-phase={phase}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium" title={headline}>
            {headline}
          </p>
          <PhaseBadge
            label={label}
            tone={tone}
            icon={
              phase === "failed" ? (
                <RiErrorWarningLine aria-hidden="true" className="size-2.5!" />
              ) : phase === "completed" ? (
                <RiCheckLine aria-hidden="true" className="size-2.5!" />
              ) : (
                <Spinner className="size-2.5!" />
              )
            }
          />
        </div>
        {item.fileSize > 0 ? <p className="text-xs text-muted-foreground">{formatBytes(item.fileSize)}</p> : null}
      </CardHeader>
      {phase === "failed" && item.failureSummary ? (
        <CardContent>
          <p role="alert" className="text-xs text-destructive">
            {item.failureSummary}
          </p>
        </CardContent>
      ) : null}
      <CardFooter className="justify-between gap-2">
        <Button asChild variant="link" size="sm" data-testid="workspace-shell-upload-item-link">
          <Link href={`/w/${encodeURIComponent(workspaceSlug)}/meetings/${encodeURIComponent(transcriptId)}`}>
            <RiExternalLinkLine data-icon="inline-start" />
            Open status page
          </Link>
        </Button>
        {isTerminal ? <DismissButton itemId={item.id} onDismiss={() => store.dismiss(item.id)} /> : null}
      </CardFooter>
    </Card>
  );
}

function PhaseBadge({ label, tone, icon }: { label: string; tone: "default" | "secondary" | "destructive"; icon?: React.ReactNode }): React.ReactElement {
  return (
    <Badge variant={tone} data-testid="workspace-shell-upload-item-phase">
      {icon ?? null}
      {label}
    </Badge>
  );
}

function DismissButton({ itemId, onDismiss }: { itemId: string; onDismiss: () => void }): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Dismiss item"
          data-testid="workspace-shell-upload-item-dismiss"
          data-item-id={itemId}
          onClick={onDismiss}
        >
          <RiCloseLine data-icon="inline-start" />
          Dismiss
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Dismiss removes the row from the upload manager. The transcript record is preserved.</TooltipContent>
    </Tooltip>
  );
}

function describeLocalPhase(phase: LocalSubmissionPhase): string {
  switch (phase) {
    case "draft":
      return "Ready to upload";
    case "normalizing":
      return "Converting to MP3…";
    case "preparing":
      return "Preparing…";
    case "uploading":
      return "Uploading…";
    case "finalizing":
      return "Finalizing…";
    case "local_error":
      return "Failed";
    default: {
      const exhaustive: never = phase;
      throw new Error(`Unhandled local phase: ${String(exhaustive)}`);
    }
  }
}

function describeServerPhase(phase: ServerProcessingPhase): string {
  switch (phase) {
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
      const exhaustive: never = phase;
      throw new Error(`Unhandled server phase: ${String(exhaustive)}`);
    }
  }
}

// Coarse-grained progress for the local submission phases. Used as a
// fallback when we do not have a determinate provider tick — for
// `normalizing`, the live Mediabunny progress (0..1, mapped to a
// percentage by `LocalPhaseCard`) takes over as soon as it arrives.
// Once the item moves to the server phases, the bar is replaced by
// the stage badge so the "this is now the worker's turn" change is
// visible.
function localProgressFor(phase: Exclude<LocalSubmissionPhase, "draft" | "local_error">): number {
  switch (phase) {
    case "normalizing":
      return 10;
    case "preparing":
      return 35;
    case "uploading":
      return 70;
    case "finalizing":
      return 95;
    default: {
      const exhaustive: never = phase;
      throw new Error(`Unhandled local phase: ${String(exhaustive)}`);
    }
  }
}

// One-line summary for the collapsed tray header. We surface the
// number of in-flight items first since that is the user's current
// concern; failures are called out separately because they need
// attention even when the rest of the queue is green.
function summarize(items: UploadManagerItem[]): string {
  let drafts = 0;
  let inFlight = 0;
  let failed = 0;
  let completed = 0;
  for (const item of items) {
    if (item.localPhase === "draft") {
      drafts += 1;
      continue;
    }
    if (item.localPhase === "local_error") {
      failed += 1;
      continue;
    }
    if (item.localPhase !== null) {
      inFlight += 1;
      continue;
    }
    if (item.serverPhase === "completed") {
      completed += 1;
      continue;
    }
    if (item.serverPhase === "failed") {
      failed += 1;
      continue;
    }
    inFlight += 1;
  }
  const parts: string[] = [];
  if (inFlight > 0) parts.push(`${inFlight} in progress`);
  if (drafts > 0) parts.push(`${drafts} ready`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (completed > 0) parts.push(`${completed} done`);
  return parts.join(" · ");
}
