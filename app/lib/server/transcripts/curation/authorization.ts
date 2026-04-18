// Pure authorization decisions for the transcript curation capability.
// Called by both the patch and delete services so the workspace role
// and creator-attribution rules stay in one place.
//
// Scope:
//   - `canPatchCuration(role)` - who may patch `customTitle`, `tags`,
//     and `isImportant`. Spec pins this at workspace `member` and
//     `admin`; `read_only` is refused.
//   - `evaluateDeleteAuthorization(...)` - whether a user may delete a
//     given transcript. Admins may delete any transcript in the
//     workspace; members may delete only transcripts whose creator
//     attribution still resolves to their own account (i.e. the
//     `createdByUserId` FK has not been cleared by account deletion).

import type { WorkspaceRole } from "@/lib/server/db/schema";

export function canPatchCuration(role: WorkspaceRole): boolean {
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

export type DeleteAuthorizationInputs = {
  role: WorkspaceRole;
  requestingUserId: string;
  transcriptCreatedByUserId: string | null;
};

export type DeleteAuthorizationDecision = { kind: "allow" } | { kind: "refuse"; reason: DeleteAuthorizationRefusalReason };

// Refusal reasons the service maps to the `forbidden` refusal. Kept
// distinct so tests and telemetry can branch on the specific case
// without pattern-matching on error messages.
export type DeleteAuthorizationRefusalReason =
  // `read_only` role has no delete authority at all.
  | "role_not_permitted"
  // Member tried to delete a transcript they did not create.
  | "not_creator"
  // Member tried to delete a retained transcript whose creator
  // account was later deleted (createdByUserId is null). Only an
  // admin can delete that record.
  | "creator_attribution_cleared";

// Evaluate the workspace authorization for a delete. Returns an
// "allow" decision when the role + attribution rules are satisfied,
// otherwise returns a refusal with a stable reason identifier.
export function evaluateDeleteAuthorization(inputs: DeleteAuthorizationInputs): DeleteAuthorizationDecision {
  const { role, requestingUserId, transcriptCreatedByUserId } = inputs;

  switch (role) {
    case "admin":
      return { kind: "allow" };
    case "member": {
      if (transcriptCreatedByUserId === null) {
        return { kind: "refuse", reason: "creator_attribution_cleared" };
      }
      if (transcriptCreatedByUserId !== requestingUserId) {
        return { kind: "refuse", reason: "not_creator" };
      }
      return { kind: "allow" };
    }
    case "read_only":
      return { kind: "refuse", reason: "role_not_permitted" };
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled workspace role: ${String(exhaustive)}`);
    }
  }
}
