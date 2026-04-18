import { jsonResponse, readJsonBody, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import { autosaveMarkdown, editSessionRefusalToHttpStatus, type MarkdownSavePatch, SessionRefusedError } from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Autosave endpoint for the active edit session. The request must
// include the `tabId` + `lockToken` pair returned by the
// `enter`/`resume` call and a `patch` covering only the
// `transcriptMarkdown`/`recapMarkdown` fields. Renewal is a side
// effect of a successful save, so there is no separate heartbeat
// endpoint.

type AutosaveBody = { tabId?: string; lockToken?: string; patch?: Partial<MarkdownSavePatch> };

export async function POST(request: Request, context: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug, transcriptId } = await context.params;
  const body = (await readJsonBody<AutosaveBody>(request)) ?? {};

  const tabId = typeof body.tabId === "string" && body.tabId.length > 0 ? body.tabId : null;
  const lockToken = typeof body.lockToken === "string" && body.lockToken.length > 0 ? body.lockToken : null;
  if (!tabId || !lockToken) {
    return jsonResponse({ ok: false, code: "invalid_input", message: "tabId and lockToken are required" }, { status: 400 });
  }
  if (!body.patch || typeof body.patch !== "object") {
    return jsonResponse({ ok: false, code: "invalid_input", message: "patch is required" }, { status: 400 });
  }

  try {
    const session = await autosaveMarkdown({
      workspaceSlug: slug,
      userId: guard.context.user.id,
      transcriptId,
      tabId,
      lockToken,
      patch: body.patch,
    });
    return jsonResponse({ ok: true, session });
  } catch (error) {
    if (error instanceof SessionRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: editSessionRefusalToHttpStatus(error.reason) });
    }
    console.error("[transcripts.edit-session] autosave failed", error);
    return serverError("Could not save your changes.");
  }
}
