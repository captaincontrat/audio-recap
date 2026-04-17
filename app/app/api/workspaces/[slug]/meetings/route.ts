import { badRequest, ensureSameOrigin, jsonResponse, readJsonBody, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import {
  AcceptancePlanTokenError,
  finalizeAcceptance,
  SubmissionRefusedError,
  submissionRefusalToHttpStatus,
  toStatusView,
  type VerifiedAcceptancePlan,
  verifyAcceptancePlan,
} from "@/lib/server/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FinalizePayload = { planToken?: string };

// The submission plan is HMAC-signed (workspace id, user id, transient
// input keys, and resolved input kind) and bound to a TTL, so the URL
// slug is redundant here — we rely on the signed plan as the source of
// truth to avoid a second workspace lookup. The slug parameter is
// retained by Next.js routing but intentionally unused.
export async function POST(request: Request, _context: { params: Promise<{ slug: string }> }) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const body = await readJsonBody<FinalizePayload>(request);
  if (!body || typeof body.planToken !== "string" || body.planToken.length === 0) {
    return badRequest("planToken is required.");
  }

  let verified: VerifiedAcceptancePlan;
  try {
    verified = verifyAcceptancePlan({ token: body.planToken, userId: guard.context.user.id });
  } catch (error) {
    if (error instanceof AcceptancePlanTokenError) {
      return jsonResponse(
        { ok: false, code: `plan_token_${error.code}`, message: "The upload session is no longer valid." },
        { status: error.code === "expired" ? 409 : 400 },
      );
    }
    console.error("[meetings.finalize] plan verification failed", error);
    return serverError("Could not finalize submission.");
  }

  try {
    const result = await finalizeAcceptance({ plan: verified.plan });
    return jsonResponse({
      ok: true,
      transcript: toStatusView(result.transcript),
    });
  } catch (error) {
    if (error instanceof SubmissionRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: submissionRefusalToHttpStatus(error.reason) });
    }
    console.error("[meetings.finalize] acceptance failed", error);
    return serverError("Could not finalize submission.");
  }
}
