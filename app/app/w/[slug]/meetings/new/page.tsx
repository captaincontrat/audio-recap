import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NewMeetingForm } from "@/components/features/meetings/new-meeting-form";
import { evaluateProtectedRoute } from "@/lib/auth/guards";
import { canRoleCreateTranscripts, getMediaNormalizationPolicy } from "@/lib/server/meetings";
import { isWorkspaceActive } from "@/lib/server/workspaces/archival-state";
import { WorkspaceAccessDeniedError, WorkspaceNotFoundError } from "@/lib/server/workspaces/errors";
import { resolveWorkspaceContextFromSlug } from "@/lib/server/workspaces/resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "New meeting",
};

export default async function NewMeetingPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const context = await resolveWorkspaceOrNotFound({ slug, userId: auth.context.user.id });

  if (!isWorkspaceActive(context.workspace)) {
    return (
      <WorkspaceNotice
        title="This workspace is archived"
        description="Archived workspaces cannot accept new submissions. Ask a workspace admin to restore it before submitting new meetings."
        slug={slug}
      />
    );
  }

  if (!canRoleCreateTranscripts(context.role)) {
    return (
      <WorkspaceNotice
        title="You do not have access to submit meetings"
        description="Only members and admins of this workspace can submit meetings. Ask a workspace admin to upgrade your role."
        slug={slug}
      />
    );
  }

  const policy = await getMediaNormalizationPolicy();

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Submit a meeting</h1>
        <p className="text-sm text-muted-foreground">
          Upload the meeting audio or video and optional notes. You will be redirected to a status page while the transcript and recap are generated.
        </p>
      </header>
      <section className="rounded-md border border-border/60 p-5">
        <NewMeetingForm workspaceSlug={slug} normalizationPolicy={policy} />
      </section>
    </main>
  );
}

async function resolveWorkspaceOrNotFound(inputs: { slug: string; userId: string }) {
  try {
    return await resolveWorkspaceContextFromSlug(inputs);
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError || error instanceof WorkspaceAccessDeniedError) {
      notFound();
    }
    throw error;
  }
}

function WorkspaceNotice({ title, description, slug }: { title: string; description: string; slug: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      <div>
        <Link href={`/w/${encodeURIComponent(slug)}`} className="text-primary underline-offset-4 hover:underline">
          Return to workspace
        </Link>
      </div>
    </main>
  );
}
