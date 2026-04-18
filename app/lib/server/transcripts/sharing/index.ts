// Barrel exports for the `add-public-transcript-sharing` capability.
// Route handlers, Server Components, and tests should import through
// this module so the capability can evolve its file layout without
// breaking downstream call sites.

export { canManagePublicSharing } from "./authorization";

export {
  type PublicShareResolutionRefusalReason,
  PublicShareResolutionRefusedError,
  type ShareManagementRefusalReason,
  ShareManagementRefusedError,
} from "./errors";

export { shareManagementRefusalToHttpStatus } from "./http-status";

export {
  applyShareUpdate,
  type FindTranscriptByPublicShareIdArgs,
  type FindTranscriptForShareArgs,
  findTranscriptByPublicShareId,
  findTranscriptForShare,
  type PublicShareLookupView,
  type ShareAuthorizationView,
} from "./queries";

export {
  disablePublicSharing,
  enablePublicSharing,
  rotatePublicShareSecret,
  type ShareManagementInputs,
} from "./service";

export {
  type PublicShareResolveInputs,
  type PublicShareView,
  resolvePublicShare,
} from "./public-resolve";
