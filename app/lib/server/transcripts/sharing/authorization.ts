// Pure authorization decisions for the public-transcript-sharing
// capability. Share management (enable, disable, rotate) is a
// workspace-collaborative action: any `member` or `admin` of an
// active workspace may flip or rotate a completed transcript's
// public share. `read_only` members get a refusal with a stable
// reason so telemetry and tests can branch without matching on
// error messages.
//
// This helper is kept as a single pure function so the service
// layer can reuse it and the authenticated detail/library UI
// Server Components can call the same predicate to decide whether
// to render management controls at all.

import type { WorkspaceRole } from "@/lib/server/db/schema";

export function canManagePublicSharing(role: WorkspaceRole): boolean {
  switch (role) {
    case "admin":
    case "member":
      return true;
    case "read_only":
      return false;
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled workspace role: ${String(exhaustive)}`);
    }
  }
}
