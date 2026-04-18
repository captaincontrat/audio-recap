// Generic deleted-user attribution label owned by
// `account-closure-retention`. When the creator account of a retained
// workspace-owned resource has been permanently deleted, the creator
// reference on that resource is null (see the `ON DELETE SET NULL` FK on
// `transcript.created_by_user_id` and similar columns). Any product
// surface that still renders creator attribution after that point must
// use this label instead of retaining deleted-account PII.

export const DELETED_USER_ATTRIBUTION_LABEL = "Former user (deleted)";

// Given the live creator attribution state, return the display string to
// render. Callers pass the current creator name and user id; when both are
// absent (the FK has been nulled after permanent deletion) the helper
// returns the generic label. The inputs are intentionally narrow so the
// contract stays identical for every caller (transcript detail, export,
// sharing, exports).
export type CreatorAttributionInput = {
  createdByUserId: string | null;
  creatorDisplayName?: string | null;
};

export function renderCreatorAttribution(input: CreatorAttributionInput): string {
  if (input.createdByUserId === null) {
    return DELETED_USER_ATTRIBUTION_LABEL;
  }
  const name = input.creatorDisplayName?.trim();
  if (!name) {
    return DELETED_USER_ATTRIBUTION_LABEL;
  }
  return name;
}
