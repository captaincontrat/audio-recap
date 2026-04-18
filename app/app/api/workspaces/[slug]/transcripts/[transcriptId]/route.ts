import { jsonResponse, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import { detailReadRefusalToHttpStatus, DetailReadRefusedError, readTranscriptDetail, toDetailView } from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Transcript detail endpoint for the durable library/detail surface.
// The client uses this to retry after a recoverable fetch error or to
// pick up newly completed content without a full page reload.
export async function GET(request: Request, context: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug, transcriptId } = await context.params;

  try {
    const row = await readTranscriptDetail({ workspaceSlug: slug, userId: guard.context.user.id, transcriptId });
    return jsonResponse({ ok: true, transcript: toDetailView(row) });
  } catch (error) {
    if (error instanceof DetailReadRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: detailReadRefusalToHttpStatus(error.reason) });
    }
    console.error("[transcripts.detail] read failed", error);
    return serverError("Could not load the transcript.");
  }
}
