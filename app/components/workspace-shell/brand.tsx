"use client";

import { RiSparkling2Line } from "@remixicon/react";
import Link from "next/link";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { useWorkspaceShell } from "./workspace-context";

// Header brand: mark + wordmark when the sidebar is expanded, mark
// only when icon-collapsed so the header's left edge stays
// proportionate to the sidebar width (per `add-workspace-app-shell`
// task 3.1). The brand link routes to the current workspace overview,
// so a click brings the user back to "home" within the shell.
export function Brand({ className }: { className?: string }) {
  const { state, isMobile } = useSidebar();
  const { workspace } = useWorkspaceShell();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Link
      href={`/w/${encodeURIComponent(workspace.slug)}`}
      data-testid="workspace-shell-brand"
      data-collapsed={collapsed ? "true" : "false"}
      aria-label="Summitdown — workspace overview"
      className={cn("flex h-7 items-center gap-2 rounded-md px-1 text-foreground transition-colors hover:text-foreground/80", className)}
    >
      <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <RiSparkling2Line className="size-3.5" />
      </span>
      <span data-slot="brand-wordmark" className={cn("text-sm font-semibold tracking-tight", collapsed ? "hidden" : "inline")}>
        Summitdown
      </span>
    </Link>
  );
}
