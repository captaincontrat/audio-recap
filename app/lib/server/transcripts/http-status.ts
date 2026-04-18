import type { DetailReadRefusalReason, LibraryReadRefusalReason } from "./errors";

// Centralize the refusal-reason → HTTP status mapping for the library
// and detail routes so the route handlers and the jsdom tests stay in
// sync. The library surface adds an `invalid_query` reason that maps to
// 400 (the client must fix its query before retrying); everything else
// follows the same mapping used by the post-submit status surface.

export function libraryReadRefusalToHttpStatus(reason: LibraryReadRefusalReason): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "access_denied":
      return 403;
    case "workspace_archived":
      return 409;
    case "invalid_query":
      return 400;
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled library read refusal reason: ${String(exhaustive)}`);
    }
  }
}

export function detailReadRefusalToHttpStatus(reason: DetailReadRefusalReason): number {
  switch (reason) {
    case "not_found":
      return 404;
    case "access_denied":
      return 403;
    case "workspace_archived":
      return 409;
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled detail read refusal reason: ${String(exhaustive)}`);
    }
  }
}
