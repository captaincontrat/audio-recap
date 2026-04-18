"use client";

import { RiArrowUpDownLine, RiArchiveLine, RiCheckLine } from "@remixicon/react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

import { useWorkspaceShell, type WorkspaceShellMembership } from "./workspace-context";

// Sidebar header workspace switcher. Surfaces the user's accessible
// workspaces so multi-membership stays visible from the shell (per
// `workspace-foundation` plus the sidebar deltas in
// `add-workspace-app-shell`). Selecting an item navigates to that
// workspace's overview route — there is no implicit "switch" notion;
// the URL slug remains authoritative.
export function WorkspaceSwitcher() {
  const { workspace, memberships } = useWorkspaceShell();
  const { isMobile } = useSidebar();
  const router = useRouter();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={workspace.name}
              data-testid="workspace-shell-switcher-trigger"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                {workspaceInitial(workspace.name, workspace.slug)}
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{workspaceLabel(workspace)}</span>
                <span className="truncate text-[0.625rem] text-sidebar-foreground/70">{workspaceSubtitle(workspace)}</span>
              </span>
              <RiArrowUpDownLine className="ml-auto size-3.5 opacity-70" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-(--radix-dropdown-menu-trigger-width) max-w-72 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">Workspaces</DropdownMenuLabel>
            {memberships.length === 0 ? (
              <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
            ) : (
              memberships.map((membership) => {
                const isActive = membership.id === workspace.id;
                return (
                  <DropdownMenuItem
                    key={membership.id}
                    data-testid="workspace-shell-switcher-item"
                    data-active={isActive ? "true" : "false"}
                    onSelect={() => {
                      router.push(`/w/${encodeURIComponent(membership.slug)}`);
                    }}
                    className="gap-2"
                  >
                    <span className="grid flex-1 leading-tight">
                      <span className="truncate text-xs font-medium">{workspaceLabel(membership)}</span>
                      <span className="truncate text-[0.625rem] text-muted-foreground">{workspaceSubtitle(membership)}</span>
                    </span>
                    {membership.archivedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1 py-0.5 text-[0.5625rem] text-muted-foreground">
                        <RiArchiveLine className="size-3" />
                        Archived
                      </span>
                    ) : null}
                    {isActive ? <RiCheckLine className="ml-1 size-3.5 text-primary" /> : null}
                  </DropdownMenuItem>
                );
              })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">Membership</DropdownMenuLabel>
            <DropdownMenuItem disabled className="text-muted-foreground">
              Workspace creation lives outside this shell — coming soon.
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function workspaceLabel(workspace: WorkspaceShellMembership): string {
  if (workspace.name.trim().length > 0) return workspace.name;
  return workspace.slug;
}

function workspaceSubtitle(workspace: WorkspaceShellMembership): string {
  if (workspace.archivedAt) return "Archived workspace";
  if (workspace.type === "personal") return "Personal workspace";
  return "Team workspace";
}

function workspaceInitial(name: string, slug: string): string {
  const source = name.trim().length > 0 ? name : slug;
  const ch = source.trim().charAt(0);
  return ch ? ch.toUpperCase() : "W";
}
