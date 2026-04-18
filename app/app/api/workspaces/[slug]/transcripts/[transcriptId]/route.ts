import { jsonResponse, serverError } from "@/lib/auth/api-response";
import { evaluateProtectedApiRequest } from "@/lib/auth/guards";
import {
  type CurationPatchInput,
  deleteRefusalToHttpStatus,
  DeleteRefusedError,
  deleteTranscript,
  detailReadRefusalToHttpStatus,
  DetailReadRefusedError,
  patchRefusalToHttpStatus,
  PatchRefusedError,
  patchTranscriptCuration,
  readTranscriptDetail,
  toDetailView,
} from "@/lib/server/transcripts";

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

// Transcript curation patch endpoint owned by
// `add-transcript-curation-controls`. Accepts a partial body with any
// of `customTitle`, `tags`, `isImportant`. The service enforces:
//   - explicit workspace route context (no session override)
//   - active-workspace gate from `add-workspace-archival-lifecycle`
//   - member/admin role
//   - tag normalization, length/count limits, and customTitle bounds
//   - not-found behavior for out-of-workspace records
//
// Responds with the refreshed detail projection so the client reflects
// the curated state (including the effective `displayTitle`) without
// a second GET.
export async function PATCH(request: Request, context: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug, transcriptId } = await context.params;

  let patch: CurationPatchInput;
  try {
    patch = await parsePatchBody(request);
  } catch {
    return jsonResponse({ ok: false, code: "invalid_patch", message: "Request body must be valid JSON" }, { status: 400 });
  }

  try {
    const row = await patchTranscriptCuration({
      workspaceSlug: slug,
      userId: guard.context.user.id,
      transcriptId,
      patch,
    });
    return jsonResponse({ ok: true, transcript: toDetailView(row) });
  } catch (error) {
    if (error instanceof PatchRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: patchRefusalToHttpStatus(error.reason) });
    }
    console.error("[transcripts.curation.patch] failed", error);
    return serverError("Could not update the transcript.");
  }
}

async function parsePatchBody(request: Request): Promise<CurationPatchInput> {
  const raw = (await request.json()) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    // Treat a non-object body (null, number, array, etc.) as an empty
    // patch so the validator produces a consistent `empty_patch`
    // refusal. Any shape-level rejection beyond that is the
    // validator's job.
    return {};
  }
  const source = raw as Record<string, unknown>;
  const patch: CurationPatchInput = {};
  if (Object.hasOwn(source, "customTitle")) {
    patch.customTitle = source.customTitle as CurationPatchInput["customTitle"];
  }
  if (Object.hasOwn(source, "tags")) {
    patch.tags = source.tags;
  }
  if (Object.hasOwn(source, "isImportant")) {
    patch.isImportant = source.isImportant;
  }
  return patch;
}

// Transcript deletion endpoint owned by
// `add-transcript-curation-controls`. The service enforces:
//   - explicit workspace route context (no session override)
//   - active-workspace gate from `add-workspace-archival-lifecycle`
//   - role + creator-attribution rules (member-owned, admin-any,
//     member+deleted-creator falls back to admin-only)
//   - same not-found behavior for out-of-workspace records as the
//     detail read path, so callers cannot probe for existence across
//     workspaces.
//
// A successful delete returns a minimal acknowledgment. The client is
// expected to evict the record from its library/detail views rather
// than receiving a detail projection (no record remains to project).
export async function DELETE(request: Request, context: { params: Promise<{ slug: string; transcriptId: string }> }) {
  const guard = await evaluateProtectedApiRequest(request.headers);
  if (!guard.ok) {
    return jsonResponse({ ok: false, code: guard.code, message: guard.message }, { status: guard.status });
  }

  const { slug, transcriptId } = await context.params;

  try {
    const result = await deleteTranscript({
      workspaceSlug: slug,
      userId: guard.context.user.id,
      transcriptId,
    });
    return jsonResponse({ ok: true, transcriptId: result.transcriptId, workspaceId: result.workspaceId });
  } catch (error) {
    if (error instanceof DeleteRefusedError) {
      return jsonResponse({ ok: false, code: error.reason, message: error.message }, { status: deleteRefusalToHttpStatus(error.reason) });
    }
    console.error("[transcripts.curation.delete] failed", error);
    return serverError("Could not delete the transcript.");
  }
}
