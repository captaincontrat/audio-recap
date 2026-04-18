"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { Brand } from "./brand";
import { SearchTrigger } from "./search-trigger";
import { ThemeToggle } from "./theme-toggle";
import { UploadHeaderControl } from "./upload-manager/header-upload-control";

// Thin header ribbon (`add-workspace-app-shell`, task 3.1):
// Left:  brand mark/wordmark + sidebar collapse trigger
// Right: search icon, upload control, theme toggle, user menu lives
//        in the sidebar footer per the design.
// Center stays intentionally empty so workspace identity reads as
// "Summitdown / <workspace name>" without competing chrome.
//
// The header is sticky so the breadcrumb band can dock immediately
// below it without the page scrolling them out of view together. The
// height is exposed as `--header-height` so SidebarInset and the
// breadcrumb band can offset their sticky tops in step.
export function SiteHeader() {
  return (
    <header
      data-testid="workspace-shell-header"
      className="sticky top-0 z-40 flex h-(--header-height) w-full items-center border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      style={{ "--header-height": "3rem" } as React.CSSProperties}
    >
      <div className="flex h-full w-full items-center gap-2 px-3">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-auto" />
        <Brand />
        <div className="flex-1" aria-hidden="true" />
        <SearchTrigger />
        <UploadHeaderControl />
        <ThemeToggle />
      </div>
    </header>
  );
}
