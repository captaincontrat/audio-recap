import type { TranscriptRow } from "@/lib/server/db/schema";

// Stable read-side title contract for the private transcript library and
// detail surfaces. This module is the only place that decides what
// `displayTitle` resolves to on a read, so the curation rule
// (`customTitle ?? title`) flows through every consumer without touching
// call sites.
//
// The helper accepts a structural shape instead of a full `TranscriptRow`
// so callers can reuse it against partial projections and against tests
// that construct literal rows. The curation change
// (`add-transcript-curation-controls`) wires `customTitle` through every
// projection so renames are reflected on reads.

export type DisplayTitleSource = {
  title: string;
  // User-owned rename override from `add-transcript-curation-controls`.
  // `null` or blank after trim means "no override, use processing title".
  customTitle?: string | null;
};

export const DISPLAY_TITLE_FALLBACK = "Untitled transcript";

// Return the stable `displayTitle` for a transcript row. The fallback is
// used only when both the custom override and the processing title are
// blank, which the spec's "baseline displayTitle sort" and "library
// card rendering" rules rely on so empty values do not surface as
// empty strings in the UI.
export function deriveDisplayTitle(row: DisplayTitleSource): string {
  const customTitle = row.customTitle?.trim();
  if (customTitle && customTitle.length > 0) {
    return customTitle;
  }
  const processingTitle = row.title.trim();
  if (processingTitle.length > 0) {
    return processingTitle;
  }
  return DISPLAY_TITLE_FALLBACK;
}

// Convenience wrapper used where we already have a full transcript row.
// Keeps the projection call sites symmetric with other read helpers.
export function deriveDisplayTitleFromRow(row: TranscriptRow): string {
  return deriveDisplayTitle({ title: row.title, customTitle: row.customTitle });
}
