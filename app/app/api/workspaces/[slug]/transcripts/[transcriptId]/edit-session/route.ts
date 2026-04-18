import { jsonResponse, readJsonBody, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import {
  type EditSessionContext,
  editSessionRefusalToHttpStatus,
  enterEditSession,
  exitEditSession,
  resumeEditSession,
  SessionRefusedError,
} from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Edit-session entry and exit endpoints. The `POST` request body can
// carry `{ intent: "enter" | "resume", tabId }` so a single route
// handles both flows; the `DELETE` body carries `{ lockToken }` so the
// client can release the lock on explicit exit. Autosave lives on its
// own sibling endpoint to keep the request shapes independent.

type EnterBody = { intent?: "enter" | "resume"; tabId?: string };
type DeleteBody = { lockToken?: string };

export async function POST(request: Request, context: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug, transcriptId } = await context.params;
  const body = (await readJsonBody<EnterBody>(request)) ?? {};

  const tabId = typeof body.tabId === "string" && body.tabId.length > 0 ? body.tabId : null;
  if (!tabId) {
    return jsonResponse({ ok: false, code: "invalid_input", message: "tabId is required" }, { status: 400 });
  }

  const intent = body.intent === "resume" ? "resume" : "enter";

  try {
    const session: EditSessionContext =
      intent === "resume"
        ? await resumeEditSession({ workspaceSlug: slug, userId: guard.context.user.id, transcriptId, tabId })
        : await enterEditSession({ workspaceSlug: slug, userId: guard.context.user.id, transcriptId, tabId });
    return jsonResponse({ ok: true, session });
  } catch (error) {
    if (error instanceof SessionRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: editSessionRefusalToHttpStatus(error.reason) });
    }
    console.error("[transcripts.edit-session] failed", error);
    return serverError("Could not open the edit session.");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug, transcriptId } = await context.params;
  const body = (await readJsonBody<DeleteBody>(request)) ?? {};

  const lockToken = typeof body.lockToken === "string" && body.lockToken.length > 0 ? body.lockToken : null;
  if (!lockToken) {
    return jsonResponse({ ok: false, code: "invalid_input", message: "lockToken is required" }, { status: 400 });
  }

  try {
    await exitEditSession({ workspaceSlug: slug, userId: guard.context.user.id, transcriptId, lockToken });
    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof SessionRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: editSessionRefusalToHttpStatus(error.reason) });
    }
    console.error("[transcripts.edit-session] exit failed", error);
    return serverError("Could not close the edit session.");
  }
}
