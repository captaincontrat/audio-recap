// Barrel exports for the `add-transcript-curation-controls` capability.
// Route handlers, Server Components, and tests should import through
// this module so the capability can evolve its file layout without
// breaking downstream call sites.

export {
  canPatchCuration,
  type DeleteAuthorizationDecision,
  type DeleteAuthorizationInputs,
  type DeleteAuthorizationRefusalReason,
  evaluateDeleteAuthorization,
} from "./authorization";

export { type DeleteCurationInputs, type DeleteCurationResult, deleteTranscript } from "./delete-service";

export { type DeleteRefusalReason, DeleteRefusedError, type PatchRefusalReason, PatchRefusedError } from "./errors";

export { deleteRefusalToHttpStatus, patchRefusalToHttpStatus } from "./http-status";

export { type PatchCurationInputs, patchTranscriptCuration } from "./patch-service";

export {
  applyCurationPatch,
  buildCurationUpdateSet,
  type CurationAuthorizationView,
  deleteTranscriptInWorkspace,
  findTranscriptForCuration,
} from "./queries";

export {
  buildTagSortKey,
  type CurationPatchInput,
  type CurationPatchValues,
  CurationValidationError,
  MAX_CUSTOM_TITLE_LENGTH,
  MAX_TAG_COUNT,
  MAX_TAG_LENGTH,
  normalizeTag,
  type PatchValidationReason,
  TAG_SORT_KEY_SEPARATOR,
  validateCurationPatch,
  validateCustomTitle,
  validateIsImportant,
  validateTags,
} from "./validation";
