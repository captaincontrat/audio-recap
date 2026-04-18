"use client";

import { type ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppSidebar } from "./app-sidebar";
import { BreadcrumbBand } from "./breadcrumb-band";
import { BreadcrumbProvider } from "./breadcrumb-context";
import { CommandPaletteProvider } from "./command-palette";
import { EditSessionPresenceProvider } from "./edit-session-presence-context";
import { SiteHeader } from "./site-header";
import { TranscriptsCountProvider } from "./transcripts-count-context";
import { UploadDropOverlay } from "./upload-manager/drop-overlay";
import { canSubmitToWorkspaceFromShellContext } from "./upload-manager/permissions";
import { UploadManagerProvider } from "./upload-manager/provider";
import { UploadManagerRehydrator } from "./upload-manager/rehydrator";
import type { RehydratedTranscriptStatus } from "./upload-manager/store";
import { UploadManagerTray } from "./upload-manager/tray";
import { WorkspaceShellContextProvider, type WorkspaceShellContextValue } from "./workspace-context";

type Props = {
  context: WorkspaceShellContextValue;
  transcriptsCount: number;
  defaultSidebarOpen: boolean;
  // Workspace's non-terminal transcripts at the moment the shell
  // mounted. The rehydrator merges them into the upload-manager
  // store so the tray reflects ongoing server-side work even on a
  // cold reload or cross-workspace return visit.
  rehydratedUploadItems: RehydratedTranscriptStatus[];
  children: ReactNode;
};

// Top-level shell composition. Mounts the provider stack the rest of
// the shell relies on — workspace context, breadcrumb publisher,
// transcripts count cache, edit-session presence, command palette,
// upload manager — and lays out the chrome around the page content.
// Designed so the per-route layout only has to call `<WorkspaceShell>`
// with server-resolved data and pass the route's children through; the
// chrome composition stays in one place.
//
// Provider order matters:
// - `TooltipProvider` MUST wrap everything that renders a tooltip
//   (sidebar trigger, breadcrumb final crumb, header buttons).
// - `EditSessionPresenceProvider` must sit above `CommandPaletteProvider`
//   so the palette's `⌘K` listener can read the live editing state
//   without prop-drilling.
// - `BreadcrumbProvider` must sit above the content slot so pages can
//   call `usePushFinalCrumb` to override the breadcrumb's final label.
// - `UploadManagerProvider` sits inside the workspace context (so it
//   can resolve the current slug and viewer's role) and outside every
//   workspace-scoped route. This is the level the design pins for the
//   tray to survive intra-shell navigation and stay scoped to the
//   current workspace.
export function WorkspaceShell({ context, transcriptsCount, defaultSidebarOpen, rehydratedUploadItems, children }: Props) {
  const canSubmit = canSubmitToWorkspaceFromShellContext(context);
  return (
    <WorkspaceShellContextProvider value={context}>
      <UploadManagerProvider workspaceSlug={context.workspace.slug} canSubmit={canSubmit}>
        <TranscriptsCountProvider value={transcriptsCount}>
          <TooltipProvider delayDuration={150}>
            <EditSessionPresenceProvider>
              <CommandPaletteProvider>
                <BreadcrumbProvider>
                  <SidebarProvider defaultOpen={defaultSidebarOpen}>
                    <AppSidebar />
                    <SidebarInset className="flex min-h-svh flex-col">
                      <SiteHeader />
                      <BreadcrumbBand />
                      <div className="flex flex-1 flex-col" data-testid="workspace-shell-content">
                        {children}
                      </div>
                    </SidebarInset>
                    <UploadDropOverlay />
                    <UploadManagerTray />
                    <UploadManagerRehydrator rehydrated={rehydratedUploadItems} />
                  </SidebarProvider>
                </BreadcrumbProvider>
              </CommandPaletteProvider>
            </EditSessionPresenceProvider>
          </TooltipProvider>
        </TranscriptsCountProvider>
        <Toaster richColors position="bottom-right" />
      </UploadManagerProvider>
    </WorkspaceShellContextProvider>
  );
}
