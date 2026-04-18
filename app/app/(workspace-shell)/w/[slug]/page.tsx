import { RiAlertFill, RiArrowRightLine, RiInboxLine } from "@remixicon/react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { OverviewStartUploadCta } from "@/components/workspace-shell/upload-manager/start-upload-cta";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import { canRoleCreateTranscripts } from "@/lib/server/meetings";
import type { TranscriptLibraryItem } from "@/lib/server/transcripts";
import { OverviewReadRefusedError, type OverviewReadResult, readWorkspaceOverview } from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspace overview",
};

// Workspace overview page owned by `add-workspace-overview-and-default-landing`,
// re-homed inside the shared shell by `add-workspace-app-shell`. The
// page no longer renders its own `<main>` chrome — `SidebarInset`
// owns the top-level frame, the breadcrumb band sits above this
// content, and the page only renders a width-constrained content
// container so typography stays consistent with the previous layout.
//
// Access model is unchanged from the pre-shell version (the route
// guard mirrors the layout's so direct navigation keeps the same
// not-found / archived semantics):
//   - inaccessible workspace -> `notFound()` so existence does not leak
//   - archived workspace     -> archived notice instead of activity groups
//   - read_only role         -> overview without the create-work CTA
export default async function WorkspaceOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const requestHeaders = await headers();
  const auth = await evaluateProtectedRoute(requestHeaders);
  if (auth.status === "unauthenticated") {
    redirect(`${auth.redirectTo}?from=/dashboard`);
  }
  if (auth.status === "unverified") {
    redirect(auth.redirectTo);
  }
  if (auth.status === "closed") {
    redirect(auth.redirectTo);
  }

  const { slug } = await params;

  let overview: OverviewReadResult;
  try {
    overview = await readWorkspaceOverview({ workspaceSlug: slug, userId: auth.context.user.id });
  } catch (error) {
    if (error instanceof OverviewReadRefusedError) {
      if (error.reason === "not_found" || error.reason === "access_denied") {
        notFound();
      }
      if (error.reason === "workspace_archived") {
        return <ArchivedWorkspaceOverview slug={slug} />;
      }
    }
    throw error;
  }

  const canCreateTranscripts = canRoleCreateTranscripts(overview.role);
  const isEmpty = overview.activeWork.length === 0 && overview.libraryHighlights.length === 0;
  const transcriptsHref = `/w/${encodeURIComponent(slug)}/transcripts`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Workspace overview</h1>
          {canCreateTranscripts ? <OverviewStartUploadCta /> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          In-flight processing, failed items that need attention, and recently updated transcripts in this workspace.
        </p>
      </header>

      {isEmpty ? (
        <EmptyOverview canCreateTranscripts={canCreateTranscripts} />
      ) : (
        <div className="flex flex-col gap-6">
          <ActiveWorkSection items={overview.activeWork} workspaceSlug={slug} />
          <LibraryHighlightsSection items={overview.libraryHighlights} workspaceSlug={slug} transcriptsHref={transcriptsHref} />
        </div>
      )}
    </div>
  );
}

function ActiveWorkSection({ items, workspaceSlug }: { items: TranscriptLibraryItem[]; workspaceSlug: string }) {
  return (
    <Card data-testid="overview-active-work">
      <CardHeader>
        <CardTitle>Active work</CardTitle>
        <CardDescription>Transcripts that are still processing or need attention after a failure.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active processing or failed transcripts right now.</p>
        ) : (
          <OverviewItemList items={items} workspaceSlug={workspaceSlug} ariaLabel="Active work" highlightFailed />
        )}
      </CardContent>
    </Card>
  );
}

function LibraryHighlightsSection({
  items,
  workspaceSlug,
  transcriptsHref,
}: {
  items: TranscriptLibraryItem[];
  workspaceSlug: string;
  transcriptsHref: string;
}) {
  return (
    <Card data-testid="overview-library-highlights">
      <CardHeader>
        <CardTitle>Library highlights</CardTitle>
        <CardDescription>Recently updated completed transcripts in this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No completed transcripts yet. They will show up here once processing finishes.</p>
        ) : (
          <OverviewItemList items={items} workspaceSlug={workspaceSlug} ariaLabel="Library highlights" />
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="link" className="px-0">
          <Link href={transcriptsHref} data-testid="overview-browse-library">
            Browse all transcripts
            <RiArrowRightLine data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function OverviewItemList({
  items,
  workspaceSlug,
  ariaLabel,
  highlightFailed = false,
}: {
  items: TranscriptLibraryItem[];
  workspaceSlug: string;
  ariaLabel: string;
  highlightFailed?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.id}>
          <OverviewItemRow item={item} workspaceSlug={workspaceSlug} highlightFailed={highlightFailed} />
        </li>
      ))}
    </ul>
  );
}

function OverviewItemRow({ item, workspaceSlug, highlightFailed }: { item: TranscriptLibraryItem; workspaceSlug: string; highlightFailed: boolean }) {
  const href = `/w/${encodeURIComponent(workspaceSlug)}/transcripts/${encodeURIComponent(item.id)}`;
  const isFailed = highlightFailed && item.status === "failed";
  const updatedAt = new Date(item.updatedAt);
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-md border border-border/60 bg-background px-3 py-2 transition-colors hover:border-border hover:bg-muted/30"
      data-testid="overview-item-row"
      data-attention={isFailed ? "true" : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{item.displayTitle}</span>
        <StatusBadge status={item.status} />
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>Updated {updatedAt.toLocaleString()}</span>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: TranscriptLibraryItem["status"] }) {
  if (status === "failed") {
    return (
      <Badge variant="destructive" data-testid="overview-status-badge" data-status={status}>
        <RiAlertFill data-icon="inline-start" />
        Failed
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge variant="outline" data-testid="overview-status-badge" data-status={status}>
        Completed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" data-testid="overview-status-badge" data-status={status}>
      {labelForActiveStatus(status)}
    </Badge>
  );
}

function labelForActiveStatus(status: TranscriptLibraryItem["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "preprocessing":
      return "Preprocessing";
    case "transcribing":
      return "Transcribing";
    case "generating_recap":
      return "Writing recap";
    case "generating_title":
      return "Titling";
    case "finalizing":
      return "Finalizing";
    case "retrying":
      return "Retrying";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled transcript status: ${String(exhaustive)}`);
    }
  }
}

function EmptyOverview({ canCreateTranscripts }: { canCreateTranscripts: boolean }) {
  return (
    <Empty data-testid="overview-empty-state">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RiInboxLine />
        </EmptyMedia>
        <EmptyTitle>No transcripts in this workspace yet</EmptyTitle>
        <EmptyDescription>
          {canCreateTranscripts
            ? "Submit a meeting to start building this workspace's library."
            : "Once a member or admin submits a meeting, the active work and library highlights will appear here."}
        </EmptyDescription>
      </EmptyHeader>
      {canCreateTranscripts ? (
        <EmptyContent>
          <OverviewStartUploadCta testId="overview-empty-start-upload-cta" />
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

function ArchivedWorkspaceOverview({ slug }: { slug: string }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6" data-testid="overview-archived-notice">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Workspace overview</h1>
        <p className="text-sm text-muted-foreground">This workspace is archived. Its activity is not available until an admin restores it.</p>
      </header>
      <Alert>
        <AlertTitle>Workspace archived</AlertTitle>
        <AlertDescription>
          Archived workspaces hide their transcripts and pause new submissions. Ask a workspace admin to restore{" "}
          <span className="font-mono text-foreground">{slug}</span> to see its activity again.
        </AlertDescription>
      </Alert>
    </div>
  );
}
