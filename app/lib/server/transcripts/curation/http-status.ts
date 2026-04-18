import type { DeleteRefusalReason, PatchRefusalReason } from "./errors";

// Centralize the refusal → HTTP status mapping so the route handlers
// and integration tests stay in sync. Mirrors the choices in
// `transcripts/http-status.ts`:
//   - not_found        -> 404 (missing record, missing workspace, or
//                         cross-workspace record that must be hidden)
//   - access_denied    -> 403 (caller is not a member of the workspace)
//   - forbidden        -> 403 (caller's role does not permit the action)
//   - workspace_archived -> 409 (active-workspace lockout)
//   - invalid_patch    -> 400 (validation failure)

export function patchRefusalToHttpStatus(reason: PatchRefusalReason): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "access_denied":
      return 403;
    case "forbidden":
      return 403;
    case "workspace_archived":
      return 409;
    case "invalid_patch":
      return 400;
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled curation patch refusal reason: ${String(exhaustive)}`);
    }
  }
}

export function deleteRefusalToHttpStatus(reason: DeleteRefusalReason): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "access_denied":
      return 403;
    case "forbidden":
      return 403;
    case "workspace_archived":
      return 409;
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled curation delete refusal reason: ${String(exhaustive)}`);
    }
  }
}
