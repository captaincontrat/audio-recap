import { jsonResponse, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import { readTranscriptStatus, StatusReadRefusedError, statusReadRefusalToHttpStatus, toStatusView } from "@/lib/server/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug, transcriptId } = await context.params;

  try {
    const row = await readTranscriptStatus({
      workspaceSlug: slug,
      userId: guard.context.user.id,
      transcriptId,
    });
    return jsonResponse({ ok: true, transcript: toStatusView(row) });
  } catch (error) {
    if (error instanceof StatusReadRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: statusReadRefusalToHttpStatus(error.reason) });
    }
    console.error("[meetings.status] read failed", error);
    return serverError("Could not read transcript status.");
  }
}
