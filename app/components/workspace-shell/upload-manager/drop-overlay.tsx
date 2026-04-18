"use client";

// Global drag-and-drop target for the workspace shell. The overlay
// only appears while the user is mid-drag with a valid file payload
// — the rest of the time the shell is unaffected. Dropping a file
// hands off to the upload manager: each dropped file becomes a draft
// row in the tray, and the user confirms before any upload begins.
//
// Per the spec, the overlay identifies the *current workspace* by
// name so the user is never in doubt about where the upload will
// land. When the viewer cannot submit (archived workspace or
// `read_only` membership), the entry point is intentionally inert:
// we do not register the global listeners at all so the page's
// native drag behavior is unchanged.
//
// Implementation notes:
// - We track a depth counter for `dragenter`/`dragleave` so the
//   overlay does not flicker when the cursor crosses nested DOM
//   boundaries inside the shell.
// - `dragover` MUST call `preventDefault` for the browser to fire a
//   `drop` event. Without it the browser interprets the drop as a
//   navigation away from the page.
// - We refuse non-file drags (e.g. text selections, image URLs)
//   because the manager only accepts media uploads.

import { RiUploadCloud2Line } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useWorkspaceShell } from "../workspace-context";
import { useUploadManagerCanSubmit, useUploadManagerStore, useUploadManagerWorkspaceSlug } from "./provider";

const ACCEPTED_FILE_PREFIXES = ["audio/", "video/"] as const;

// Some browsers leave the file's mime type empty when the asset is
// dragged from outside the OS chrome. We accept anything in those
// cases — the server-side acceptance check still validates the
// extension before queueing.
function dataTransferIncludesFiles(transfer: DataTransfer | null): boolean {
  if (!transfer) return false;
  const types = transfer.types;
  for (let i = 0; i < types.length; i += 1) {
    if (types[i] === "Files") return true;
  }
  return false;
}

function isAcceptableFile(file: File): boolean {
  if (file.size === 0) return false;
  const type = file.type.toLowerCase();
  if (type === "") return true;
  return ACCEPTED_FILE_PREFIXES.some((prefix) => type.startsWith(prefix));
}

export function UploadDropOverlay(): React.ReactElement | null {
  const canSubmit = useUploadManagerCanSubmit();
  const store = useUploadManagerStore();
  const workspaceSlug = useUploadManagerWorkspaceSlug();
  const { workspace } = useWorkspaceShell();
  const [isDragging, setIsDragging] = useState(false);
  // Track nested-element drag enters so the overlay does not flicker
  // every time the cursor crosses a child element. The browser fires
  // `dragleave` on the previous target before `dragenter` on the new
  // one, so a depth counter is the simplest stable tracker.
  const depthRef = useRef(0);

  const reset = useCallback(() => {
    depthRef.current = 0;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!canSubmit) return;
    if (typeof window === "undefined") return;

    function onDragEnter(event: DragEvent) {
      if (!dataTransferIncludesFiles(event.dataTransfer)) return;
      event.preventDefault();
      depthRef.current += 1;
      if (depthRef.current === 1) {
        setIsDragging(true);
      }
    }

    function onDragOver(event: DragEvent) {
      if (!dataTransferIncludesFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    }

    function onDragLeave(event: DragEvent) {
      if (!dataTransferIncludesFiles(event.dataTransfer)) return;
      event.preventDefault();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) {
        setIsDragging(false);
      }
    }

    function onDrop(event: DragEvent) {
      if (!dataTransferIncludesFiles(event.dataTransfer)) return;
      event.preventDefault();
      reset();
      const files = Array.from(event.dataTransfer?.files ?? []);
      for (const file of files) {
        if (!isAcceptableFile(file)) continue;
        store.addDraft({ workspaceSlug, file });
      }
    }

    function onWindowBlur() {
      // Browsers do not always emit `dragleave` when the user drops
      // outside the window or alt-tabs away. Reset on blur so we do
      // not stay stuck in the overlay state.
      reset();
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [canSubmit, reset, store, workspaceSlug]);

  if (!canSubmit) return null;
  if (!isDragging) return null;

  return (
    <div
      data-testid="workspace-shell-upload-drop-overlay"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="presentation"
    >
      <div className="pointer-events-none flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/60 bg-popover/95 px-8 py-6 text-center text-popover-foreground shadow-lg ring-1 ring-foreground/10">
        <RiUploadCloud2Line aria-hidden="true" className="size-10 text-primary" />
        <p className="text-sm font-medium">Drop to upload to {workspace.name}</p>
        <p className="text-xs text-muted-foreground">Audio or video, up to 500 MB. You can review and confirm before processing starts.</p>
      </div>
    </div>
  );
}
