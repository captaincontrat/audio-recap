import type { ExportFormat } from "./formats";

// Title-derived export filename builder owned by
// `add-client-side-transcript-export`. The design pins download names
// to the current display title and the selected format so users
// recognize the file at the point of download, while the sanitizer
// strips characters that would break typical file systems (Windows,
// macOS) or trigger path-traversal surprises.
//
// Sanitization rules:
//   - Strip control characters and path-reserved punctuation.
//   - Collapse any run of whitespace to a single ASCII space.
//   - Trim surrounding whitespace and leading/trailing dots so the
//     filename never becomes a hidden file or ends with a dot.
//   - Cap the base name length so combined `<title>.<ext>` stays
//     well below the 255-byte filename limit typical of target OSes
//     even after UTF-8 expansion.
//
// If sanitization consumes every character, a neutral fallback is used
// to keep the download meaningful without leaking internal record IDs.

export const EXPORT_FILENAME_FALLBACK = "transcript";

const ILLEGAL_CHARACTERS = /[\u0000-\u001F\u007F"*/:<>?\\|]/g;
const WHITESPACE_RUN = /\s+/g;
const LEADING_TRAILING_DOTS = /^\.+|\.+$/g;
const MAX_BASE_LENGTH = 120;

export function buildExportFilename(args: { displayTitle: string; format: ExportFormat }): string {
  const base = sanitizeTitle(args.displayTitle);
  return `${base}.${args.format}`;
}

function sanitizeTitle(rawTitle: string): string {
  const withoutIllegal = rawTitle.replace(ILLEGAL_CHARACTERS, " ");
  const collapsed = withoutIllegal.replace(WHITESPACE_RUN, " ").trim();
  const withoutBoundaryDots = collapsed.replace(LEADING_TRAILING_DOTS, "").trim();
  if (withoutBoundaryDots.length === 0) {
    return EXPORT_FILENAME_FALLBACK;
  }
  if (withoutBoundaryDots.length <= MAX_BASE_LENGTH) {
    return withoutBoundaryDots;
  }
  return withoutBoundaryDots.slice(0, MAX_BASE_LENGTH).trimEnd();
}
