"use client";

import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Header theme toggle. Per the design (`add-workspace-app-shell`),
// the toggle lives in the header rather than inside the user menu so
// flipping the read/write tone stays a one-click action on this
// reading-heavy product.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Pre-mount the icon for SSR with a stable choice; once mounted we
  // flip to the resolved theme. This avoids a hydration warning when
  // the client picks `dark` after reading the system preference.
  const isDark = mounted && resolvedTheme === "dark";
  const nextLabel = isDark ? "Switch to light" : "Switch to dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={nextLabel}
          data-testid="workspace-shell-theme-toggle"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <RiSunLine /> : <RiMoonLine />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{nextLabel}</TooltipContent>
    </Tooltip>
  );
}
