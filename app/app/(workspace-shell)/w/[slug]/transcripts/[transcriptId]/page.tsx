import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  type CurationCapabilities,
  TranscriptDetailView,
  type DetailView,
  type ShareCapabilities,
} from "@/components/features/transcripts/transcript-detail-view";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import type { WorkspaceRole } from "@/lib/server/db/schema";
import {
  canManagePublicSharing,
  canPatchCuration,
  DetailReadRefusedError,
  evaluateDeleteAuthorization,
  readTranscriptDetailWithRole,
  toDetailView,
} from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transcript",
};

// Private transcript detail page, re-homed inside `(workspace-shell)`
// by `add-workspace-app-shell`. The "← All transcripts" back-link the
// pre-shell version carried is dropped in favour of the breadcrumb
// band the shell renders directly above this content. The detail view
// itself publishes the transcript display title to the band via
// `usePushFinalCrumb` so the final crumb shows the human-readable
// title rather than the opaque transcript id segment.
//
// Access semantics are unchanged: archived workspaces render an
// inline notice, not-found / access-denied collapse to `notFound()`
// (so existence does not leak across workspaces), and unexpected
// errors fall through to Next's error boundary which the route's
// `error.tsx` handles.
export default async function TranscriptDetailPage({ params }: { params: Promise<{ slug: string; transcriptId: string }> }) {
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

  const { slug, transcriptId } = await params;

  let initial: DetailView;
  let role: WorkspaceRole;
  let createdByUserId: string | null;
  try {
    const result = await readTranscriptDetailWithRole({ workspaceSlug: slug, userId: auth.context.user.id, transcriptId });
    initial = toDetailView(result.row);
    role = result.role;
    createdByUserId = result.row.createdByUserId;
  } catch (error) {
    if (error instanceof DetailReadRefusedError) {
      if (error.reason === "not_found" || error.reason === "access_denied") {
        notFound();
      }
      if (error.reason === "workspace_archived") {
        return <ArchivedWorkspaceNotice />;
      }
    }
    throw error;
  }

  const canEditMarkdown = role === "admin" || role === "member";
  const curation = evaluateCurationCapabilities({ role, requestingUserId: auth.context.user.id, transcriptCreatedByUserId: createdByUserId });
  const sharing: ShareCapabilities = { canManageSharing: canManagePublicSharing(role) };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <TranscriptDetailView
        workspaceSlug={slug}
        transcriptId={transcriptId}
        initial={initial}
        canEditMarkdown={canEditMarkdown}
        curation={curation}
        sharing={sharing}
      />
    </div>
  );
}

// Resolve the workspace role + creator-attribution rules into the
// capability payload the curation panel renders off. Runs on the
// server because it mirrors the authoritative decision the PATCH /
// DELETE endpoints make; the client surface just reflects the outcome.
function evaluateCurationCapabilities({
  role,
  requestingUserId,
  transcriptCreatedByUserId,
}: {
  role: WorkspaceRole;
  requestingUserId: string;
  transcriptCreatedByUserId: string | null;
}): CurationCapabilities {
  const canCurate = canPatchCuration(role);
  const decision = evaluateDeleteAuthorization({ role, requestingUserId, transcriptCreatedByUserId });
  if (decision.kind === "allow") {
    return { canCurate, canDelete: true, deleteDisabledReason: null };
  }
  return {
    canCurate,
    canDelete: false,
    deleteDisabledReason: deleteDisabledCopyFor(decision.reason),
  };
}

// User-facing copy explaining why a workspace user cannot delete a
// specific transcript. Admins can always delete, so they never see
// this path.
function deleteDisabledCopyFor(reason: "role_not_permitted" | "not_creator" | "creator_attribution_cleared"): string {
  switch (reason) {
    case "role_not_permitted":
      return "Only members and admins can delete transcripts in this workspace.";
    case "not_creator":
      return "Only the member who submitted this transcript can delete it, or a workspace admin.";
    case "creator_attribution_cleared":
      return "The original submitter's account was deleted. Only a workspace admin can delete this transcript now.";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled delete-disabled reason: ${String(exhaustive)}`);
    }
  }
}

function ArchivedWorkspaceNotice() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">Workspace archived</h1>
      <p className="text-muted-foreground">This workspace is archived. Its transcripts are not available until an admin restores the workspace.</p>
    </div>
  );
}
