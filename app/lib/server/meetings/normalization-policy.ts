import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { appSetting, type MediaNormalizationPolicyValue } from "@/lib/server/db/schema";

// Database-backed setting that governs whether new submissions can
// fall back to their original validated upload when browser-side
// normalization fails or is unavailable. The key is kept small and
// stable so migrations never need to rename it.
export const MEDIA_NORMALIZATION_POLICY_KEY = "media_normalization_policy" as const;

// Default stays `optional` so brand-new environments without an
// operator-chosen policy accept submissions even when the browser
// cannot normalize. Operators tighten this to `required` through
// the same row once policy-management UI lands.
export const DEFAULT_MEDIA_NORMALIZATION_POLICY: MediaNormalizationPolicyValue = "optional";

type PolicyShape = { value: MediaNormalizationPolicyValue };

function isPolicyShape(candidate: unknown): candidate is PolicyShape {
  if (typeof candidate !== "object" || candidate === null) return false;
  const { value } = candidate as { value?: unknown };
  return value === "optional" || value === "required";
}

// Read the currently active media-normalization policy. Missing or
// malformed values fall back to the default so a fresh database
// serves the baseline policy without a manual seed step.
export async function getMediaNormalizationPolicy(): Promise<MediaNormalizationPolicyValue> {
  const rows = await getDb().select().from(appSetting).where(eq(appSetting.key, MEDIA_NORMALIZATION_POLICY_KEY)).limit(1);
  const row = rows[0];
  if (!row) {
    return DEFAULT_MEDIA_NORMALIZATION_POLICY;
  }
  if (isPolicyShape(row.value)) {
    return row.value.value;
  }
  return DEFAULT_MEDIA_NORMALIZATION_POLICY;
}

// Upsert the current policy. Intended for operator tooling and tests
// rather than a per-request surface.
export async function setMediaNormalizationPolicy(value: MediaNormalizationPolicyValue, now: Date = new Date()): Promise<void> {
  const payload: PolicyShape = { value };
  await getDb()
    .insert(appSetting)
    .values({
      key: MEDIA_NORMALIZATION_POLICY_KEY,
      value: payload,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appSetting.key,
      set: { value: payload, updatedAt: now },
    });
}
