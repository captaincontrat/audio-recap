import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";

import { PublicShareResolutionRefusedError, resolvePublicShare } from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  // Static title so the public route does not leak transcript titles
  // through `<title>` at routing-layer metadata resolution.
  title: "Shared transcript",
  robots: { index: false, follow: false },
  // `no-referrer` prevents the full `/share/<id>/<secret>` URL from
  // being sent as a Referer header when visitors click outbound
  // links embedded in the recap or transcript markdown. Without
  // this, the share secret could leak into third-party access logs
  // and analytics, effectively defeating the rotatable-secret
  // privacy model.
  referrer: "no-referrer",
};

// Public read-only transcript page owned by
// `add-public-transcript-sharing`. The resolver is the single source
// of truth for whether a link is currently serveable — every refusal
// path (missing share id, wrong secret, disabled share, rotated out,
// transcript not completed, workspace archived, post-restore
// suppression) collapses to the same `notFound()` response so the
// public surface never reveals which condition fired. The server log
// emitted inside the catch preserves the specific reason so operators
// can still diagnose issues without leaking that information to
// visitors.
//
// This page renders only the three privacy-minimal fields the spec
// permits:
//   - display title
//   - canonical recap markdown
//   - canonical transcript markdown
// Every other transcript field (ids, creator, tags, status, notes
// metadata, source media metadata, share-management state) stays
// server-side. The surface is read-only even if the viewer is signed
// into the owning workspace — share controls live exclusively on the
// authenticated detail page.
export default async function PublicSharePage({ params }: { params: Promise<{ publicShareId: string; shareSecretId: string }> }) {
  const { publicShareId, shareSecretId } = await params;

  let view: Awaited<ReturnType<typeof resolvePublicShare>>;
  try {
    view = await resolvePublicShare({ publicShareId, shareSecretId });
  } catch (error) {
    if (error instanceof PublicShareResolutionRefusedError) {
      console.info("[public-share.resolve] refused", { reason: error.reason });
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Shared transcript</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{view.displayTitle}</h1>
      </header>
      <PublicMarkdownSection title="Recap" markdown={view.recapMarkdown} />
      <PublicMarkdownSection title="Transcript" markdown={view.transcriptMarkdown} variant="transcript" />
    </main>
  );
}

// Minimal markdown section for the public surface. Renders the raw
// canonical markdown text verbatim in a `<pre>` block so structured
// lists and headings stay readable without adding an HTML renderer
// dependency. Empty markdown would only happen if the authenticated
// side allowed publishing an empty recap/transcript, which the
// management surface actively prevents — but the guard message still
// keeps the rendered page intentionally bland.
function PublicMarkdownSection({ title, markdown, variant = "recap" }: { title: string; markdown: string; variant?: "recap" | "transcript" }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {markdown.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">This section is empty.</p>
      ) : (
        <pre
          className={cn(
            "whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/20 p-4 font-sans text-sm leading-relaxed text-foreground",
            variant === "transcript" ? "max-h-[32rem] overflow-y-auto" : undefined,
          )}
        >
          {markdown}
        </pre>
      )}
    </section>
  );
}
