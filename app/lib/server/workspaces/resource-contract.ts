import { text } from "drizzle-orm/pg-core";
import { user, workspace } from "@/lib/server/db/schema";

// Shared shape that every transcript-adjacent product resource (transcript
// jobs, transcripts, transcript edits, exports, shares, future event rows
// such as meeting processing artifacts) MUST adopt. This is the concrete
// implementation of the design decision "Make workspace the durable
// ownership boundary and preserve creator attribution separately" from
// `openspec/changes/add-workspace-foundation/design.md`.
//
// Ownership lifecycle:
// - `workspaceId` is required and never null. It represents the durable
//   ownership boundary and only changes through an explicit transfer
//   operation (a future capability). Cascading workspace deletes remove
//   the owned resource along with the workspace.
// - `createdByUserId` is the account that created the resource and is
//   nullable from day one. While the creator account exists the column
//   carries its user id; later account-lifecycle capabilities (account
//   closure, retention) are expected to null this column out without
//   changing `workspaceId`. Downstream migrations MUST use
//   `ON DELETE SET NULL` on the FK so workspace ownership survives a
//   permanently deleted creator account.

export type WorkspaceScopedResource = {
  id: string;
  workspaceId: string;
  createdByUserId: string | null;
};

// Drizzle column helpers consumed by downstream schema files so every
// workspace-scoped table matches the contract exactly. Call these inside
// `pgTable("...", (t) => ({ ...workspaceOwnershipColumns(), ... }))`.

export function workspaceOwnershipColumns() {
  return {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  };
}

// Callers whose resource should also be protected from orphaning can
// combine this helper with additional guards, but the default contract
// sets the minimum required behavior.
