import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell/workspace-shell";
import { type WorkspaceShellContextValue, type WorkspaceShellMembership } from "@/components/workspace-shell/workspace-context";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import { listUploadManagerRehydrationItems, type UploadManagerRehydrationItem } from "@/lib/server/meetings";
import { countTranscriptsForWorkspace } from "@/lib/server/transcripts";
import { listAccessibleWorkspacesForUser } from "@/lib/server/workspaces/memberships";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server layout for the private `(workspace-shell)` route group. It is
// intentionally per-workspace (sits at `w/[slug]`) so the shell always
// has a concrete workspace to display in the sidebar header, the
// breadcrumb root, and the transcripts count badge — the design rules
// the slug authoritative for shell context.
//
// Auth + workspace gates run here once and are also enforced inside
// each child page (which keeps the per-page error handling intact).
// Both calls are pure reads that share the database connection pool,
// so the small duplication keeps the page-level redirect/notFound
// behavior unchanged while letting the layout fail closed before the
// chrome ever renders.
export default async function WorkspaceShellLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
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
  const userId = auth.context.user.id;

  let workspaceContext;
  try {
    workspaceContext = await resolveWorkspaceContextFromSlug({ slug, userId });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError || error instanceof WorkspaceAccessDeniedError) {
      notFound();
    }
    throw error;
  }

  const memberships = await listAccessibleWorkspacesForUser(userId);
  const transcriptsCount = await countTranscriptsForWorkspace({ workspaceId: workspaceContext.workspace.id });
  // Rehydration is best-effort: a transient DB hiccup must not block
  // the entire shell from rendering. The tray simply starts empty in
  // that case and the user can still interact with the rest of the
  // workspace; new submissions also continue to work because they
  // populate the tray locally.
  const rehydratedUploadItems = await safeListUploadManagerRehydrationItems({ workspaceSlug: slug, userId });
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_state")?.value;
  const defaultSidebarOpen = sidebarCookie === "false" ? false : true;

  const shellContext: WorkspaceShellContextValue = {
    workspace: toShellMembership(workspaceContext.workspace),
    memberships: composeShellMemberships(memberships, workspaceContext.workspace.id),
    user: {
      id: auth.context.user.id,
      name: auth.context.user.name,
      email: auth.context.user.email,
      image: auth.context.user.image ?? null,
    },
    currentRole: workspaceContext.role,
  };

  return (
    <WorkspaceShell
      context={shellContext}
      transcriptsCount={transcriptsCount}
      defaultSidebarOpen={defaultSidebarOpen}
      rehydratedUploadItems={rehydratedUploadItems}
    >
      {children}
    </WorkspaceShell>
  );
}

async function safeListUploadManagerRehydrationItems(args: { workspaceSlug: string; userId: string }): Promise<UploadManagerRehydrationItem[]> {
  try {
    return await listUploadManagerRehydrationItems(args);
  } catch (error) {
    console.error("[workspace-shell] upload-manager rehydration failed", error);
    return [];
  }
}

// The switcher should always reveal the *current* workspace — even
// when archived — and otherwise list the user's other active
// memberships. We pull from the membership rows already fetched for
// the resolver's landing logic so this layout never issues a second
// round-trip per render. Active workspaces are listed in the order
// returned by `listAccessibleWorkspacesForUser` (last-accessed
// descending) so the most recently used workspace sits near the top.
function composeShellMemberships(
  memberships: Awaited<ReturnType<typeof listAccessibleWorkspacesForUser>>,
  currentWorkspaceId: string,
): WorkspaceShellMembership[] {
  const currentEntry = memberships.find((entry) => entry.workspace.id === currentWorkspaceId);
  const others = memberships.filter((entry) => entry.workspace.id !== currentWorkspaceId && entry.workspace.archivedAt === null);
  const ordered = currentEntry ? [currentEntry, ...others] : [...others];
  return ordered.map((entry) => toShellMembership(entry.workspace));
}

function toShellMembership(row: { id: string; slug: string; name: string; type: "personal" | "team"; archivedAt: Date | null }): WorkspaceShellMembership {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}
