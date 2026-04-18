"use client";

// Header-level upload entry point. Renders alongside the search
// trigger and theme toggle on the right edge of the shell header.
// Activating it opens a hidden file picker; the chosen file becomes
// a draft row in the upload manager, exactly the same hand-off the
// global drop overlay produces. Both entry points feed the same
// store so the tray surfaces them identically.
//
// The button is rendered as disabled when the viewer cannot submit
// (archived workspace or `read_only` membership). We keep the
// affordance visible — rather than hiding it — so the user
// understands that the workspace is paused; the tooltip explains
// why.

import { RiUploadCloud2Line } from "@remixicon/react";
import { useCallback, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useWorkspaceShell } from "../workspace-context";
import { canRoleSubmitTranscripts } from "./permissions";
import { useUploadManagerCanSubmit, useUploadManagerStore, useUploadManagerWorkspaceSlug } from "./provider";

const ACCEPT_ATTRIBUTE = "audio/*,video/*";

export function UploadHeaderControl({ className }: { className?: string }): React.ReactElement {
  const canSubmit = useUploadManagerCanSubmit();
  const store = useUploadManagerStore();
  const workspaceSlug = useUploadManagerWorkspaceSlug();
  const { workspace, currentRole } = useWorkspaceShell();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onClick = useCallback(() => {
    if (!canSubmit) return;
    inputRef.current?.click();
  }, [canSubmit]);

  const onFilesSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      for (const file of files) {
        store.addDraft({ workspaceSlug, file });
      }
      // Reset the input so selecting the same file twice still emits
      // a `change` event for the second selection.
      event.target.value = "";
    },
    [store, workspaceSlug],
  );

  const tooltipCopy = canSubmit
    ? "Upload a meeting to this workspace"
    : workspace.archivedAt !== null
      ? "Archived workspaces cannot accept new uploads"
      : !canRoleSubmitTranscripts(currentRole)
        ? "Your role in this workspace cannot upload meetings"
        : "Uploads are not available";

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          {/*
            We keep the button mounted even when disabled so the
            tooltip target stays predictable. `disabled` and
            `aria-disabled` mirror each other so screen readers and
            pointer hit-testing agree.
          */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Upload a meeting to this workspace"
            data-testid="workspace-shell-upload-header-control"
            data-can-submit={canSubmit ? "true" : "false"}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            onClick={onClick}
            className={className}
          >
            <RiUploadCloud2Line data-icon="inline-start" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipCopy}</TooltipContent>
      </Tooltip>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="sr-only"
        onChange={onFilesSelected}
        data-testid="workspace-shell-upload-header-input"
        tabIndex={-1}
      />
    </>
  );
}
