"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";

import { useBreadcrumbContext } from "./breadcrumb-context";
import { useWorkspaceShell } from "./workspace-context";

// Sticky breadcrumb band rendered inside `SidebarInset` directly above
// page content (`add-workspace-app-shell` task 4.1). The band lives in
// its own row — never inside the header — so the workspace name stays
// visible on long meeting titles. Content-width on desktop, full
// viewport on mobile (the inset already collapses there).
//
// Composition rules baked in:
// - root crumb is the current workspace name and never shrinks (4.2)
// - the final crumb truncates first with a full-label tooltip (4.3)
// - middle crumbs collapse into a `BreadcrumbEllipsis` dropdown when
//   the chain still overflows (4.3)
// - pages can push a human-readable label for the final crumb via
//   `usePushFinalCrumb` (4.4)
// - the band MUST NOT carry processing state (4.5) — that lives in
//   the upload manager landing in the next change.
export function BreadcrumbBand() {
  const { workspace } = useWorkspaceShell();
  const pathname = usePathname();
  const breadcrumb = useBreadcrumbContext();

  const segments = useMemo(() => buildBreadcrumbSegments(pathname, workspace.slug), [pathname, workspace.slug]);
  const finalSegment = segments[segments.length - 1];
  const trailingLabel = breadcrumb?.finalCrumbLabel ?? null;
  const overrideFinalLabel = trailingLabel && finalSegment ? trailingLabel : null;

  return (
    <div
      data-testid="workspace-shell-breadcrumb-band"
      className="sticky top-(--header-height) z-30 flex h-9 w-full items-center border-b border-border/40 bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <Breadcrumb>
        <BreadcrumbList className="flex-nowrap text-xs">
          <BreadcrumbItem className="shrink-0">
            {segments.length === 0 ? (
              <BreadcrumbPage data-testid="workspace-shell-breadcrumb-root">{workspace.name || workspace.slug}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href={`/w/${encodeURIComponent(workspace.slug)}`} data-testid="workspace-shell-breadcrumb-root">
                  {workspace.name || workspace.slug}
                </Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          <MiddleCrumbs segments={segments} workspaceSlug={workspace.slug} />
          {finalSegment ? <FinalCrumb label={overrideFinalLabel ?? finalSegment.label} /> : null}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

// Stitch the middle-of-chain crumbs together. When the chain has more
// than one middle crumb the helper renders the first verbatim and
// collapses the remaining middles into a `BreadcrumbEllipsis`
// dropdown so the workspace root and final crumb always have room.
// One middle crumb renders inline.
function MiddleCrumbs({ segments, workspaceSlug }: { segments: BreadcrumbSegment[]; workspaceSlug: string }) {
  if (segments.length <= 1) return null;
  const middles = segments.slice(0, -1);
  if (middles.length === 1) {
    const only = middles[0]!;
    return (
      <>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0 shrink">
          <BreadcrumbLink asChild className="truncate">
            <Link href={hrefFor(workspaceSlug, only)} data-testid="workspace-shell-breadcrumb-middle">
              {only.label}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
      </>
    );
  }
  const first = middles[0]!;
  const collapsed = middles.slice(1);
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem className="min-w-0 shrink">
        <BreadcrumbLink asChild className="truncate">
          <Link href={hrefFor(workspaceSlug, first)} data-testid="workspace-shell-breadcrumb-middle">
            {first.label}
          </Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center rounded-md p-1 hover:bg-muted hover:text-foreground"
            aria-label="More breadcrumb segments"
            data-testid="workspace-shell-breadcrumb-ellipsis"
          >
            <BreadcrumbEllipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4} className="min-w-44">
            {collapsed.map((segment) => (
              <DropdownMenuItem key={segment.href} asChild>
                <Link href={hrefFor(workspaceSlug, segment)}>{segment.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </BreadcrumbItem>
    </>
  );
}

// Final (page-title) crumb. Always renders truncated; if the label
// has been overridden by the page (e.g., a transcript display title),
// we wrap it in a tooltip so the full text is one hover away.
function FinalCrumb({ label }: { label: string }) {
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem className="min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <BreadcrumbPage className="block max-w-full truncate" data-testid="workspace-shell-breadcrumb-page">
              {label}
            </BreadcrumbPage>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start">
            {label}
          </TooltipContent>
        </Tooltip>
      </BreadcrumbItem>
    </>
  );
}

type BreadcrumbSegment = {
  href: string;
  label: string;
};

// Derive default crumbs from the current pathname after stripping the
// workspace root. Pages may override the final crumb's label through
// `usePushFinalCrumb` for routes whose segment is opaque (transcript
// id, meeting id). The label fallback is a humanised version of the
// raw URL segment so the band always has *something* meaningful to
// show before the page-side override settles.
function buildBreadcrumbSegments(pathname: string | null, workspaceSlug: string): BreadcrumbSegment[] {
  if (!pathname) return [];
  const root = `/w/${encodeURIComponent(workspaceSlug)}`;
  if (!pathname.startsWith(root)) return [];
  const remainder = pathname.slice(root.length).replace(/^\/+/, "");
  if (remainder.length === 0) return [];
  const parts = remainder.split("/").filter((part) => part.length > 0);
  let cumulativeHref = root;
  const segments: BreadcrumbSegment[] = [];
  for (const raw of parts) {
    cumulativeHref = `${cumulativeHref}/${raw}`;
    segments.push({ href: cumulativeHref, label: humaniseSegment(raw) });
  }
  return segments;
}

function hrefFor(_workspaceSlug: string, segment: BreadcrumbSegment): string {
  return segment.href;
}

// Map a raw URL segment to a presentable label. Known sub-roots get
// canonical names; opaque ids fall back to a shortened form so the
// breadcrumb is never empty before a page-side override lands.
function humaniseSegment(segment: string): string {
  switch (segment) {
    case "transcripts":
      return "Transcripts";
    case "meetings":
      return "Meetings";
    case "new":
      return "New";
    default:
      return shortenIdLike(segment);
  }
}

// Opaque-id heuristic: if the segment looks like a uuid/cuid we shorten
// it to "<head>…" so the breadcrumb stays readable until the page pushes
// a real label (e.g., transcript display title) via the breadcrumb
// context.
function shortenIdLike(segment: string): string {
  const decoded = decodeURIComponentSafe(segment);
  if (decoded.length <= 12) return decoded;
  if (/^[a-z0-9-]+$/i.test(decoded)) {
    return `${decoded.slice(0, 8)}…`;
  }
  return decoded;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
