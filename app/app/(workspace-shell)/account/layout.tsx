import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { type BreadcrumbRootConfig } from "@/components/workspace-shell/breadcrumb-root-context";
import { type WorkspaceShellContextValue, type WorkspaceShellMembership } from "@/components/workspace-shell/workspace-context";
import { WorkspaceShell } from "@/components/workspace-shell/workspace-shell";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import { getServerTranslator } from "@/lib/i18n/server";
import { listUploadManagerRehydrationItems, type UploadManagerRehydrationItem } from "@/lib/server/meetings";
import { countTranscriptsForWorkspace } from "@/lib/server/transcripts";
import { listAccessibleWorkspacesForUser } from "@/lib/server/workspaces/memberships";
import { resolveDefaultWorkspaceContextForUser } from "@/lib/server/workspaces/resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server layout for authenticated user-scoped account-settings pages
// hosted inside the shared shell (`add-account-pages-inside-shell`).
// `/account/security` and `/account/close` render through this layout
// so the chrome (sidebar workspace switcher, header upload control,
// drop overlay, breadcrumb band, upload-manager tray) matches the
// rest of the signed-in product.
//
// Account URLs are intentionally global (not multiplied across
// workspace slugs), so the shell needs a "current workspace" context
// resolved from somewhere other than a `[slug]` route segment. We
// reuse the same default-workspace logic as the `/dashboard`
// redirect entry point — last successfully used accessible active
// workspace, otherwise the user's personal workspace — and feed that
// resolution into every workspace-scoped shell feature. The
// breadcrumb meanwhile uses an `account` root variant so the chain
// does NOT misrepresent account settings as belonging to whichever
// workspace got resolved.
//
// Auth is enforced here once and again per page so a freshly closed
// account or a stale cookie short-circuits before the shell ever
// renders. Recent-auth and per-page closure rechecks live on the
// page itself (see `security/page.tsx`, `close/page.tsx`) because
// they redirect to the bare `/account/recent-auth` step-up gate.
export default async function AccountShellLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const auth = await evaluateProtectedRoute(requestHeaders);
  if (auth.status === "unauthenticated") {
    redirect(`${auth.redirectTo}?from=/account/security`);
  }
  if (auth.status === "unverified") {
    redirect(auth.redirectTo);
  }
  if (auth.status === "closed") {
    redirect(auth.redirectTo);
  }

  const userId = auth.context.user.id;
  const workspaceContext = await resolveDefaultWorkspaceContextForUser({ userId });

  const memberships = await listAccessibleWorkspacesForUser(userId);
  const transcriptsCount = await countTranscriptsForWorkspace({ workspaceId: workspaceContext.workspace.id });
  const rehydratedUploadItems = await safeListUploadManagerRehydrationItems({
    workspaceSlug: workspaceContext.workspace.slug,
    userId,
  });
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_state")?.value;
  const defaultSidebarOpen = sidebarCookie === "false" ? false : true;

  const { translate } = await getServerTranslator();
  const breadcrumbRoot: BreadcrumbRootConfig = {
    kind: "account",
    rootLabel: translate("chrome.shell.breadcrumb.accountRoot"),
    sectionLabels: {
      security: translate("chrome.shell.breadcrumb.accountSecurity"),
      close: translate("chrome.shell.breadcrumb.accountClose"),
    },
  };

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
      breadcrumbRoot={breadcrumbRoot}
    >
      {children}
    </WorkspaceShell>
  );
}

async function safeListUploadManagerRehydrationItems(args: { workspaceSlug: string; userId: string }): Promise<UploadManagerRehydrationItem[]> {
  try {
    return await listUploadManagerRehydrationItems(args);
  } catch (error) {
    console.error("[account-shell] upload-manager rehydration failed", error);
    return [];
  }
}

// Mirrors the workspace-shell layout: the switcher always reveals
// the resolved workspace (even when archived), then lists the user's
// other active memberships in last-accessed-descending order.
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
