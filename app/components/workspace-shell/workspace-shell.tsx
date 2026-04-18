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
import { WorkspaceShellContextProvider, type WorkspaceShellContextValue } from "./workspace-context";

type Props = {
  context: WorkspaceShellContextValue;
  transcriptsCount: number;
  defaultSidebarOpen: boolean;
  children: ReactNode;
};

// Top-level shell composition. Mounts the provider stack the rest of
// the shell relies on — workspace context, breadcrumb publisher,
// transcripts count cache, edit-session presence, command palette —
// and lays out the chrome around the page content. Designed so the
// per-route layout only has to call `<WorkspaceShell>` with server-
// resolved data and pass the route's children through; the chrome
// composition stays in one place.
//
// Provider order matters:
// - `TooltipProvider` MUST wrap everything that renders a tooltip
//   (sidebar trigger, breadcrumb final crumb, header buttons).
// - `EditSessionPresenceProvider` must sit above `CommandPaletteProvider`
//   so the palette's `⌘K` listener can read the live editing state
//   without prop-drilling.
// - `BreadcrumbProvider` must sit above the content slot so pages can
//   call `usePushFinalCrumb` to override the breadcrumb's final label.
export function WorkspaceShell({ context, transcriptsCount, defaultSidebarOpen, children }: Props) {
  return (
    <WorkspaceShellContextProvider value={context}>
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
                </SidebarProvider>
              </BreadcrumbProvider>
            </CommandPaletteProvider>
          </EditSessionPresenceProvider>
        </TooltipProvider>
      </TranscriptsCountProvider>
      <Toaster richColors position="bottom-right" />
    </WorkspaceShellContextProvider>
  );
}
