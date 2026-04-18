import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BreadcrumbProvider } from "@/components/workspace-shell/breadcrumb-context";
import { CommandPaletteProvider } from "@/components/workspace-shell/command-palette";
import { EditSessionPresenceProvider } from "@/components/workspace-shell/edit-session-presence-context";
import { TranscriptsCountProvider } from "@/components/workspace-shell/transcripts-count-context";
import {
  WorkspaceShellContextProvider,
  type WorkspaceShellContextValue,
  type WorkspaceShellMembership,
  type WorkspaceShellUser,
} from "@/components/workspace-shell/workspace-context";

// Default fixtures used across the workspace-shell tests. Every helper
// override-merges into these so individual tests only spell out the
// surface they actually exercise.
const DEFAULT_USER: WorkspaceShellUser = {
  id: "user-1",
  name: "Riley Ledger",
  email: "riley@summitdown.test",
  image: null,
};

const DEFAULT_WORKSPACE: WorkspaceShellMembership = {
  id: "ws-personal",
  slug: "riley",
  name: "Riley's Workspace",
  type: "personal",
  archivedAt: null,
};

const TEAM_WORKSPACE: WorkspaceShellMembership = {
  id: "ws-team",
  slug: "team-summit",
  name: "Summit Team",
  type: "team",
  archivedAt: null,
};

export function makeShellContext(overrides: Partial<WorkspaceShellContextValue> = {}): WorkspaceShellContextValue {
  return {
    workspace: overrides.workspace ?? DEFAULT_WORKSPACE,
    memberships: overrides.memberships ?? [DEFAULT_WORKSPACE, TEAM_WORKSPACE],
    user: overrides.user ?? DEFAULT_USER,
  };
}

export type ShellRenderOptions = {
  // Server-resolved data. Pass an explicit `null` for `transcriptsCount`
  // to omit the cache provider — useful when verifying that consumers
  // tolerate the missing context (the badge hides itself).
  context?: WorkspaceShellContextValue;
  transcriptsCount?: number | null;
  defaultSidebarOpen?: boolean;
  // Whether to wrap children with `CommandPaletteProvider`. The
  // command-palette tests render the provider explicitly so they can
  // assert the dialog mount-point; other shell tests get it for free
  // so the provider's keyboard listener does not throw when shortcuts
  // fire during simulated input events.
  withCommandPalette?: boolean;
} & Omit<RenderOptions, "wrapper">;

// Wraps children in the same provider stack `<WorkspaceShell>` mounts,
// minus the page chrome. This lets tests render single shell
// components (sidebar, breadcrumb band, search trigger, …) under the
// real context they would see in production.
export function renderInShell(ui: ReactElement, options: ShellRenderOptions = {}): RenderResult {
  const { context = makeShellContext(), transcriptsCount = 0, defaultSidebarOpen = true, withCommandPalette = true, ...rest } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = (
      <BreadcrumbProvider>
        <SidebarProvider defaultOpen={defaultSidebarOpen}>{children}</SidebarProvider>
      </BreadcrumbProvider>
    );
    const withCount = transcriptsCount === null ? tree : <TranscriptsCountProvider value={transcriptsCount}>{tree}</TranscriptsCountProvider>;
    const withPalette = withCommandPalette ? <CommandPaletteProvider>{withCount}</CommandPaletteProvider> : withCount;
    return (
      <WorkspaceShellContextProvider value={context}>
        <TooltipProvider delayDuration={0}>
          <EditSessionPresenceProvider>{withPalette}</EditSessionPresenceProvider>
        </TooltipProvider>
      </WorkspaceShellContextProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...rest });
}

export { DEFAULT_USER, DEFAULT_WORKSPACE, TEAM_WORKSPACE };
