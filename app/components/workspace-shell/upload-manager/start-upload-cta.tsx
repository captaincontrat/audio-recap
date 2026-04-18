"use client";

// Workspace-overview-flavored start-upload CTA. Same hand-off as the
// shell drop overlay and the header upload control: opens a hidden
// file picker, drops the chosen files into the upload manager as
// drafts, and lets the tray surface them. The dedicated submission
// page stays reachable via direct links — this CTA just no longer
// navigates there.
//
// The component is rendered inert (and the tooltip explains why) when
// the viewer is not allowed to submit, mirroring the header control.
// The overview server page handles role/archival gating before
// rendering this CTA so we do not normally see the inert state, but
// the tooltip remains as a defensive belt-and-suspenders measure.

import { RiUploadCloud2Line } from "@remixicon/react";
import { useCallback, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useWorkspaceShell } from "../workspace-context";
import { canRoleSubmitTranscripts } from "./permissions";
import { useUploadManagerCanSubmit, useUploadManagerStore, useUploadManagerWorkspaceSlug } from "./provider";

const ACCEPT_ATTRIBUTE = "audio/*,video/*";

type Props = {
  // Optional override so the empty-state CTA can carry a different
  // test id than the header CTA. Defaults to the header value used
  // in the existing overview tests.
  testId?: string;
  className?: string;
};

export function OverviewStartUploadCta({ testId = "overview-start-upload-cta", className }: Props): React.ReactElement {
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
          <Button
            type="button"
            data-testid={testId}
            data-can-submit={canSubmit ? "true" : "false"}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            onClick={onClick}
            className={className}
          >
            <RiUploadCloud2Line data-icon="inline-start" />
            Start upload
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
        data-testid={`${testId}-input`}
        tabIndex={-1}
      />
    </>
  );
}
