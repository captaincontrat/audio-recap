"use client";

import { RiHome5Line, RiStackLine } from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { NavUser } from "./nav-user";
import { useTranscriptsCount } from "./transcripts-count-context";
import { useWorkspaceShell } from "./workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

// Three-region workspace sidebar (`add-workspace-app-shell` design):
// header = workspace switcher, content = Overview + Transcripts
// (with the workspace's library count next to Transcripts), footer =
// user menu. Every region collapses to its icon-only equivalent
// without losing a destination, satisfying task 2.2.
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { workspace, user } = useWorkspaceShell();
  const pathname = usePathname();
  const count = useTranscriptsCount();

  const overviewHref = `/w/${encodeURIComponent(workspace.slug)}`;
  const transcriptsHref = `/w/${encodeURIComponent(workspace.slug)}/transcripts`;
  const isOverviewActive = matchesWorkspaceRoot(pathname, workspace.slug);
  const isTranscriptsActive = matchesWorkspaceSection(pathname, workspace.slug, "transcripts");

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isOverviewActive} tooltip="Overview" data-testid="workspace-shell-nav-overview">
                  <Link href={overviewHref}>
                    <RiHome5Line />
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isTranscriptsActive} tooltip="Transcripts" data-testid="workspace-shell-nav-transcripts">
                  <Link href={transcriptsHref}>
                    <RiStackLine />
                    <span>Transcripts</span>
                    {count !== null ? (
                      <span
                        data-testid="workspace-shell-nav-transcripts-count"
                        className="ml-auto text-[0.625rem] tabular-nums text-muted-foreground group-data-[collapsible=icon]:hidden"
                      >
                        {formatCount(count)}
                      </span>
                    ) : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

// Active-state matchers for the nav. Active is path-prefix based
// rather than exact-match because nested routes (a transcript detail,
// for example) should still highlight the parent destination.
function matchesWorkspaceRoot(pathname: string | null, slug: string): boolean {
  if (!pathname) return false;
  const root = `/w/${encodeURIComponent(slug)}`;
  return pathname === root;
}

function matchesWorkspaceSection(pathname: string | null, slug: string, section: string): boolean {
  if (!pathname) return false;
  const root = `/w/${encodeURIComponent(slug)}/${section}`;
  return pathname === root || pathname.startsWith(`${root}/`);
}

// Compact display so the badge does not push the destination label
// off-screen at narrow sidebar widths. Numbers up to 999 render
// verbatim; everything else collapses to "1k+", "2k+", … with no
// decimal noise.
function formatCount(count: number): string {
  if (count < 1000) return String(count);
  const thousands = Math.floor(count / 1000);
  return `${thousands}k+`;
}
