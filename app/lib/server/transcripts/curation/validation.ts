// Pure validation helpers owned by `add-transcript-curation-controls`.
// The patch service composes these into the end-to-end curation flow;
// tests import them directly to exercise the rules without standing up
// a workspace or database.
//
// The spec pins the following invariants that must be enforced here
// rather than in the repository or the route handler:
//
//   - `customTitle` is a nullable, length-bounded override; blank
//     strings clear the override and fall back to the processing-owned
//     `title` through the `deriveDisplayTitle` helper.
//   - Tags are a normalized (lowercased, trimmed) set of strings with
//     case-insensitive deduplication and bounded count and per-tag
//     length. The normalized form is the canonical value that flows
//     into the database.
//   - `isImportant` is a boolean; the surface rejects any other shape.

// Maximum user-visible `customTitle` length. Kept conservative so the
// library card and detail header can render the rename on a single
// line without wrapping far past the processing title width.
export const MAX_CUSTOM_TITLE_LENGTH = 200;

// Maximum number of tags a single transcript can carry and the maximum
// length of any individual tag. Both limits are enforced on the
// normalized form so a caller cannot dodge the count limit by
// submitting visual duplicates that collapse at normalization.
export const MAX_TAG_COUNT = 20;
export const MAX_TAG_LENGTH = 32;

// Stable sort-key separator used to build the derived tag sort key. A
// control character is intentionally chosen because tags are
// normalized to printable ASCII after trim/lowercase, so the separator
// never appears in any individual tag and the sort remains
// deterministic.
export const TAG_SORT_KEY_SEPARATOR = "\u0001";

// Reasons a patch request is refused for invalid input. The patch
// service maps each reason to a stable HTTP 400 response shape and the
// UI uses the reason to show a targeted inline error.
export type PatchValidationReason =
  | "custom_title_too_long"
  | "custom_title_invalid_type"
  | "tags_too_many"
  | "tag_too_long"
  | "tag_empty_after_normalization"
  | "tag_invalid_type"
  | "tags_invalid_type"
  | "important_invalid_type"
  | "empty_patch";

export class CurationValidationError extends Error {
  readonly code = "curation_patch_invalid" as const;
  readonly reason: PatchValidationReason;
  constructor(reason: PatchValidationReason, message?: string) {
    super(message ?? defaultMessageFor(reason));
    this.name = "CurationValidationError";
    this.reason = reason;
  }
}

function defaultMessageFor(reason: PatchValidationReason): string {
  switch (reason) {
    case "custom_title_too_long":
      return `Custom title must be ${MAX_CUSTOM_TITLE_LENGTH} characters or fewer`;
    case "custom_title_invalid_type":
      return "Custom title must be a string or null";
    case "tags_too_many":
      return `A transcript can carry at most ${MAX_TAG_COUNT} tags`;
    case "tag_too_long":
      return `Each tag must be ${MAX_TAG_LENGTH} characters or fewer`;
    case "tag_empty_after_normalization":
      return "Tags cannot be empty once normalized";
    case "tag_invalid_type":
      return "Each tag must be a string";
    case "tags_invalid_type":
      return "Tags must be an array of strings";
    case "important_invalid_type":
      return "Important flag must be a boolean";
    case "empty_patch":
      return "Patch must include at least one of customTitle, tags, or isImportant";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled curation validation reason: ${String(exhaustive)}`);
    }
  }
}

// Patch shape accepted by the curation service. Each field is
// optional: the service applies only the fields explicitly present so
// unrelated curation state is not overwritten by a partial patch.
export type CurationPatchInput = {
  customTitle?: string | null;
  tags?: unknown;
  isImportant?: unknown;
};

export type CurationPatchValues = {
  customTitle?: string | null;
  tags?: string[];
  tagSortKey?: string | null;
  isImportant?: boolean;
};

// Normalize and validate a patch body into the canonical values the
// repository writes. Throws `CurationValidationError` on any invalid
// field so the route handler can translate it to a stable refusal.
// Fields that are absent from the input (either the key is missing or
// its value is `undefined`) stay absent in the output so the caller's
// `update(...)` call only touches the columns the user actually
// changed. `null` is preserved for `customTitle` because the spec uses
// it to clear a previous rename override; the other fields reject
// `null` because they are not nullable at rest.
export function validateCurationPatch(input: CurationPatchInput): CurationPatchValues {
  const values: CurationPatchValues = {};
  let fieldsPresent = 0;

  if (isPresent(input, "customTitle")) {
    values.customTitle = validateCustomTitle(input.customTitle);
    fieldsPresent += 1;
  }

  if (isPresent(input, "tags")) {
    const normalizedTags = validateTags(input.tags);
    values.tags = normalizedTags;
    values.tagSortKey = buildTagSortKey(normalizedTags);
    fieldsPresent += 1;
  }

  if (isPresent(input, "isImportant")) {
    values.isImportant = validateIsImportant(input.isImportant);
    fieldsPresent += 1;
  }

  if (fieldsPresent === 0) {
    throw new CurationValidationError("empty_patch");
  }

  return values;
}

// `customTitle` accepts:
//   - `null` or empty-after-trim → clear the override, let
//     `displayTitle` fall back to processing title.
//   - a non-empty string up to `MAX_CUSTOM_TITLE_LENGTH` (trimmed).
// Rejects anything else.
export function validateCustomTitle(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new CurationValidationError("custom_title_invalid_type");
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_CUSTOM_TITLE_LENGTH) {
    throw new CurationValidationError("custom_title_too_long");
  }
  return trimmed;
}

// Normalize a tag: trim, lower-case. Rejects non-strings, empty
// normalized values, and over-long tags. Callers should not call this
// directly - prefer `validateTags` so the count limit and deduplication
// apply together.
export function normalizeTag(value: unknown): string {
  if (typeof value !== "string") {
    throw new CurationValidationError("tag_invalid_type");
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new CurationValidationError("tag_empty_after_normalization");
  }
  if (normalized.length > MAX_TAG_LENGTH) {
    throw new CurationValidationError("tag_too_long");
  }
  return normalized;
}

// Validate and normalize a tag list. Returns the canonical
// deduplicated lowercased set that the repository writes. Case-
// insensitive duplicates collapse to one entry; preserves the order
// of first appearance so round-trip calls stay deterministic.
export function validateTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new CurationValidationError("tags_invalid_type");
  }
  if (value.length > MAX_TAG_COUNT) {
    throw new CurationValidationError("tags_too_many");
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of value) {
    const tag = normalizeTag(entry);
    if (seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }
  if (normalized.length > MAX_TAG_COUNT) {
    throw new CurationValidationError("tags_too_many");
  }
  return normalized;
}

export function validateIsImportant(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new CurationValidationError("important_invalid_type");
  }
  return value;
}

// Build the derived tag sort key used by the important / tag-aware
// library sorts. The key is the sorted normalized tag list joined by
// a stable separator; untagged records return `null` so PostgreSQL's
// default NULLS LAST (asc) / NULLS FIRST (desc) semantics produce the
// "untagged after tagged for asc, untagged before tagged for desc"
// rule the spec requires.
export function buildTagSortKey(tags: string[]): string | null {
  if (tags.length === 0) return null;
  const sorted = [...tags].sort((a, b) => a.localeCompare(b));
  return sorted.join(TAG_SORT_KEY_SEPARATOR);
}

// Treat a key as "present" when the caller explicitly supplies a value
// other than `undefined`. JSON decoders never produce `undefined`, but
// internal callers that spread an object with optional keys can, and
// the patch semantics require "absent ⇒ no-op", not "absent ⇒ validate
// undefined".
function isPresent<T extends object, K extends keyof T & string>(obj: T, key: K): boolean {
  if (!Object.hasOwn(obj, key)) return false;
  return obj[key] !== undefined;
}
