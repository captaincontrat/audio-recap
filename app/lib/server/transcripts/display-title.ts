import type { TranscriptRow } from "@/lib/server/db/schema";

// Stable read-side title contract for the private transcript library and
// detail surfaces. This module is the only place that decides what
// `displayTitle` resolves to on a read, so later curation work can layer
// its effective-title rule (`customTitle ?? title`) onto this helper
// without touching every consumer.
//
// Today `displayTitle` equals the processing-owned `title`. The helper
// accepts a structural shape instead of a full `TranscriptRow` so
// callers can reuse it against partial projections and against tests
// that construct literal rows.

export type DisplayTitleSource = {
  title: string;
  // Reserved for `add-transcript-curation-controls`: when a custom rename
  // lands, consumers will populate `customTitle` and this helper will
  // start applying the effective-title rule. Callers must still call
  // through this helper rather than picking the raw fields themselves,
  // so the read contract stays centralized.
  customTitle?: string | null;
};

export const DISPLAY_TITLE_FALLBACK = "Untitled transcript";

// Return the stable `displayTitle` for a transcript row. The fallback is
// used only when both the processing title and any future custom title
// are blank, which the spec's "baseline displayTitle sort" and "library
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
  return deriveDisplayTitle({ title: row.title });
}
