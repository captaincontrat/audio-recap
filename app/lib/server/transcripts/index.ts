// Barrel re-exports for the `private-transcript-library` capability.
// Upstream route handlers, Server Components, and tests should import
// through this module so the capability can evolve its file layout
// without breaking downstream call sites.

export {
  buildTagSortKey,
  type CurationPatchInput,
  type CurationPatchValues,
  CurationValidationError,
  canPatchCuration,
  type DeleteCurationInputs,
  type DeleteCurationResult,
  type DeleteRefusalReason,
  DeleteRefusedError,
  deleteRefusalToHttpStatus,
  deleteTranscript,
  evaluateDeleteAuthorization,
  MAX_CUSTOM_TITLE_LENGTH,
  MAX_TAG_COUNT,
  MAX_TAG_LENGTH,
  normalizeTag,
  type PatchCurationInputs,
  type PatchRefusalReason,
  PatchRefusedError,
  patchRefusalToHttpStatus,
  patchTranscriptCuration,
  TAG_SORT_KEY_SEPARATOR,
  validateCurationPatch,
} from "./curation";
export { CursorDecodeError, type CursorPayload, decodeCursor, encodeCursor } from "./cursor";
export { type DetailReadInputs, type DetailReadWithRoleResult, readTranscriptDetail, readTranscriptDetailWithRole } from "./detail-read";
export { DISPLAY_TITLE_FALLBACK, type DisplayTitleSource, deriveDisplayTitle, deriveDisplayTitleFromRow } from "./display-title";
export {
  AUTOSAVE_DEBOUNCE_MS,
  type AutosaveInputs,
  type AutosaveResult,
  autosaveMarkdown,
  EDIT_LOCK_FIELDS,
  type EditLockField,
  type EditSessionContext,
  type EnterSessionInputs as EnterEditSessionInputs,
  editSessionRefusalToHttpStatus,
  enterEditSession,
  exitEditSession,
  generateTabSessionId,
  type MarkdownSavePatch,
  RESUME_RECONNECT_WINDOW_MS,
  type ResumeSessionInputs as ResumeEditSessionInputs,
  resumeEditSession,
  SESSION_EXPIRY_MS,
  type SessionRefusalReason,
  SessionRefusedError,
  sanitizeMarkdownPatch,
} from "./edit-sessions";

export {
  type DetailReadRefusalReason,
  DetailReadRefusedError,
  type LibraryReadRefusalReason,
  LibraryReadRefusedError,
  type OverviewReadRefusalReason,
  OverviewReadRefusedError,
} from "./errors";

export { detailReadRefusalToHttpStatus, libraryReadRefusalToHttpStatus } from "./http-status";

export { type LibraryReadInputs, type LibraryReadResult, readTranscriptLibrary } from "./library-read";

export { OVERVIEW_GROUP_LIMIT, type OverviewReadInputs, type OverviewReadResult, readWorkspaceOverview } from "./overview-read";

export {
  buildSharePath,
  type TranscriptDetailView,
  type TranscriptLibraryItem,
  type TranscriptSummaryRow,
  toDetailView,
  toLibraryItem,
} from "./projections";
export {
  ACTIVE_WORK_STATUSES,
  countTranscriptsForWorkspace,
  findTranscriptDetailForWorkspace,
  listActiveWorkTranscriptsForWorkspace,
  listLibraryHighlightsForWorkspace,
  listTranscriptsForWorkspace,
} from "./queries";
export {
  escapeSearchForIlike,
  LIBRARY_DEFAULT_PAGE_SIZE,
  LIBRARY_MAX_PAGE_SIZE,
  LIBRARY_MAX_SEARCH_LENGTH,
  LIBRARY_MAX_TAG_FILTER_COUNT,
  LIBRARY_STATUS_FILTER_OPTIONS,
  type LibraryImportantFilter,
  type LibraryQueryOptions,
  LibraryQueryParseError,
  type LibraryQueryParseFailureReason,
  type LibraryRawQuery,
  type LibrarySharedFilter,
  parseLibraryQueryOptions,
} from "./query-options";
export {
  canManagePublicSharing,
  disablePublicSharing,
  enablePublicSharing,
  findTranscriptByPublicShareId,
  findTranscriptForShare,
  type PublicShareLookupView,
  type PublicShareResolutionRefusalReason,
  PublicShareResolutionRefusedError,
  type PublicShareResolveInputs,
  type PublicShareView,
  resolvePublicShare,
  rotatePublicShareSecret,
  type ShareAuthorizationView,
  type ShareManagementInputs,
  type ShareManagementRefusalReason,
  ShareManagementRefusedError,
  shareManagementRefusalToHttpStatus,
} from "./sharing";

export {
  DEFAULT_LIBRARY_SORT,
  isAscendingSort,
  isTitleSort,
  LIBRARY_SORT_OPTIONS,
  type LibrarySortColumn,
  type LibrarySortOption,
  parseLibrarySort,
  sortColumnFor,
} from "./sort-options";
