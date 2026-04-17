import { badRequest, ensureSameOrigin, jsonResponse, readJsonBody, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import { getStorageConfig } from "@/lib/server/storage";
import {
  type AcceptancePlan,
  type AcceptancePresigns,
  type BrowserNormalizationOutcome,
  planAcceptance,
  presignPlanUploads,
  signAcceptancePlan,
  SubmissionRefusedError,
  submissionRefusalToHttpStatus,
} from "@/lib/server/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreparePayload = {
  sourceMediaKind?: "audio" | "video";
  mediaBytes?: number;
  mediaContentType?: string;
  mediaFilename?: string;
  notesText?: string;
  normalization?: BrowserNormalizationOutcome;
};

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug } = await context.params;
  const body = await readJsonBody<PreparePayload>(request);
  if (!body) {
    return badRequest("Missing request body.");
  }

  const mediaKind = body.sourceMediaKind;
  if (mediaKind !== "audio" && mediaKind !== "video") {
    return badRequest('sourceMediaKind must be "audio" or "video".');
  }
  if (typeof body.mediaBytes !== "number" || !Number.isFinite(body.mediaBytes) || body.mediaBytes <= 0) {
    return badRequest("mediaBytes must be a positive number.");
  }
  if (typeof body.mediaContentType !== "string" || body.mediaContentType.trim().length === 0) {
    return badRequest("mediaContentType is required.");
  }
  if (!isNormalizationOutcome(body.normalization)) {
    return badRequest("normalization outcome is required.");
  }

  let plan: AcceptancePlan;
  try {
    plan = await planAcceptance({
      workspaceSlug: slug,
      userId: guard.context.user.id,
      sourceMediaKind: mediaKind,
      mediaBytes: Math.floor(body.mediaBytes),
      mediaContentType: body.mediaContentType,
      ...(typeof body.mediaFilename === "string" ? { mediaFilename: body.mediaFilename } : {}),
      ...(typeof body.notesText === "string" && body.notesText.length > 0 ? { notesText: body.notesText } : {}),
      normalization: body.normalization,
    });
  } catch (error) {
    if (error instanceof SubmissionRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: submissionRefusalToHttpStatus(error.reason) });
    }
    console.error("[meetings.prepare] planning failed", error);
    return serverError("Could not prepare submission.");
  }

  let presigns: AcceptancePresigns;
  try {
    presigns = await presignPlanUploads({
      plan,
      mediaContentLength: Math.floor(body.mediaBytes),
      ...(typeof body.notesText === "string" ? { notesContentLength: Buffer.byteLength(body.notesText, "utf8") } : {}),
    });
  } catch (error) {
    console.error("[meetings.prepare] presign failed", error);
    return serverError("Could not issue upload URLs.");
  }

  const ttlSeconds = getStorageConfig().presignedPutTtlSeconds;
  const planToken = signAcceptancePlan({
    plan,
    userId: guard.context.user.id,
    ttlSeconds,
  });

  return jsonResponse({
    ok: true,
    planToken,
    expiresInSec: ttlSeconds,
    uploads: {
      media: presigns.media,
      notes: presigns.notes,
    },
    submission: {
      uploadId: plan.prepared.uploadId,
      resolvedMediaInputKind: plan.resolvedMediaInputKind,
      mediaNormalizationPolicySnapshot: plan.mediaNormalizationPolicySnapshot,
    },
  });
}

function isNormalizationOutcome(value: unknown): value is BrowserNormalizationOutcome {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "unavailable" || kind === "failed") return true;
  if (kind === "succeeded") {
    const inputKind = (value as { inputKind?: unknown }).inputKind;
    return inputKind === "mp3-derivative";
  }
  return false;
}
