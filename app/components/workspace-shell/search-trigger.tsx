"use client";

import { RiSearchLine } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useCommandPalette } from "./command-palette";
import { useIsMacOs } from "./use-platform";

// Reserved header search slot. Per the design (`add-workspace-app-shell`),
// this MUST be a non-input affordance — a disabled `<input>` would
// invite typing that goes nowhere. The icon plus the visible kbd hint
// keeps the surface honest about its pre-launch state.
export function SearchTrigger({ className }: { className?: string }) {
  const { setOpen } = useCommandPalette();
  const isMac = useIsMacOs();
  const modifierLabel = isMac ? "⌘" : "Ctrl";
  const shortcutLabel = isMac ? "⌘ K" : "Ctrl K";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Search this workspace (${shortcutLabel})`}
          data-testid="workspace-shell-search-trigger"
          onClick={() => setOpen(true)}
          className={className}
        >
          <RiSearchLine data-icon="inline-start" />
          <span className="hidden sm:inline">Search</span>
          <KbdGroup className="hidden sm:inline-flex">
            <Kbd>{modifierLabel}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Open workspace search</TooltipContent>
    </Tooltip>
  );
}
