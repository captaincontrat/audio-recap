import { badRequest, ensureSameOrigin, jsonResponse, readJsonBody, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import {
  disablePublicSharing,
  enablePublicSharing,
  rotatePublicShareSecret,
  shareManagementRefusalToHttpStatus,
  ShareManagementRefusedError,
  toDetailView,
} from "@/lib/server/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public-sharing management endpoint owned by
// `add-public-transcript-sharing`. A single POST route handles the
// three verbs via a discriminated `action` body so the management UI
// can call the same endpoint for enable/disable/rotate without
// multiplying route files. This matches the design doc's simple
// "workspace-managed sharing" model:
//
//   - action: "enable"  -> creates or reuses the stable publicShareId,
//                          mints a fresh shareSecretId, sets
//                          isPubliclyShared=true. Requires the
//                          transcript to be in `completed` status.
//   - action: "disable" -> flips isPubliclyShared=false and clears
//                          shareSecretId so cached URLs cannot
//                          resurrect if the share is re-enabled.
//   - action: "rotate"  -> mints a fresh shareSecretId, invalidating
//                          the prior URL immediately. Requires the
//                          share to currently be enabled.
//
// Every refusal path maps to the shared `ShareManagementRefusedError`
// vocabulary which the HTTP-status helper translates to 400/403/404/
// 409. Responds with the refreshed detail projection on success so
// the client reflects the updated `share` state (including the new
// `publicSharePath` when enabled or rotated) without a second GET.

type ShareActionBody = { action: "enable" } | { action: "disable" } | { action: "rotate" };

export async function POST(request: Request, context: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }
  const originGuard = ensureSameOrigin(request);
  if (originGuard) return originGuard;

  const { slug, transcriptId } = await context.params;

  const parsed = parseActionBody(await readJsonBody(request));
  if (!parsed) {
    return badRequest("Request body must include action: 'enable' | 'disable' | 'rotate'", "invalid_action");
  }

  try {
    const row = await dispatchShareAction(parsed.action, { workspaceSlug: slug, userId: guard.context.user.id, transcriptId });
    return jsonResponse({ ok: true, transcript: toDetailView(row) });
  } catch (error) {
    if (error instanceof ShareManagementRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: shareManagementRefusalToHttpStatus(error.reason) });
    }
    console.error("[transcripts.share.manage] failed", error);
    return serverError("Could not update public sharing for this transcript.");
  }
}

type DispatchInputs = { workspaceSlug: string; userId: string; transcriptId: string };

async function dispatchShareAction(action: ShareActionBody["action"], inputs: DispatchInputs) {
  switch (action) {
    case "enable":
      return enablePublicSharing(inputs);
    case "disable":
      return disablePublicSharing(inputs);
    case "rotate":
      return rotatePublicShareSecret(inputs);
    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled share action: ${String(exhaustive)}`);
    }
  }
}

function parseActionBody(raw: unknown): ShareActionBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const action = source.action;
  if (action === "enable" || action === "disable" || action === "rotate") {
    return { action };
  }
  return null;
}
