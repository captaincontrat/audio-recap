import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { type TranscriptRow, transcript } from "@/lib/server/db/schema";

import { type EditLockField, EDIT_LOCK_FIELDS } from "./constants";

// Persistence helpers for the transcript markdown edit-session
// capability. The exported writer is deliberately narrow: it only
// accepts the two markdown columns the lock protects, so metadata-only
// actions (rename, tags, important toggle, share state) cannot ride
// piggyback on the autosave path.

// Patch shape the autosave service passes through from the route
// handler. Both fields are optional so a client that only touched one
// of the two text surfaces does not need to send the other.
export type MarkdownSavePatch = Partial<Record<EditLockField, string>>;

export type PersistMarkdownInputs = {
  transcriptId: string;
  workspaceId: string;
  patch: MarkdownSavePatch;
  now: Date;
};

// Persist the patched markdown fields and bump `updated_at` to the
// autosave moment. Returns the updated transcript row so the caller
// can echo the freshly saved content back to the client. Returns
// `null` when the transcript does not exist or belongs to a different
// workspace - the service layer collapses that into a "session
// expired" response to keep cross-workspace probes hidden.
export async function persistMarkdownSave(inputs: PersistMarkdownInputs): Promise<TranscriptRow | null> {
  const values = buildUpdateValues(inputs.patch, inputs.now);
  if (!values) {
    const existing = await getDb()
      .select()
      .from(transcript)
      .where(and(eq(transcript.id, inputs.transcriptId), eq(transcript.workspaceId, inputs.workspaceId)))
      .limit(1);
    return existing[0] ?? null;
  }

  const updated = await getDb()
    .update(transcript)
    .set(values)
    .where(and(eq(transcript.id, inputs.transcriptId), eq(transcript.workspaceId, inputs.workspaceId)))
    .returning();
  return updated[0] ?? null;
}

// Build the Drizzle `set(...)` payload. Keeping it as its own helper
// makes the "only lock-protected fields are writable" rule easy to
// audit: anything outside `EDIT_LOCK_FIELDS` is ignored by
// construction, not merely by convention. Returns `null` when the
// patch touches none of the locked fields so the caller can skip the
// write entirely.
export function buildUpdateValues(patch: MarkdownSavePatch, now: Date): Record<string, string | Date> | null {
  const values: Record<string, string | Date> = {};
  let changed = false;
  for (const field of EDIT_LOCK_FIELDS) {
    const next = patch[field];
    if (typeof next !== "string") continue;
    values[field] = next;
    changed = true;
  }
  if (!changed) return null;
  values.updatedAt = now;
  return values;
}

// Normalize whatever body the route handler received into the
// strictly-typed patch. Any key that is not one of the locked fields
// is silently dropped so metadata-only properties can never leak into
// an autosave call. Returns an empty patch when the body is not an
// object.
export function sanitizeMarkdownPatch(body: unknown): MarkdownSavePatch {
  if (!body || typeof body !== "object") return {};
  const source = body as Record<string, unknown>;
  const patch: MarkdownSavePatch = {};
  for (const field of EDIT_LOCK_FIELDS) {
    const value = source[field];
    if (typeof value === "string") {
      patch[field] = value;
    }
  }
  return patch;
}
