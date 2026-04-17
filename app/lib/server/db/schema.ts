import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Tables that Better Auth owns. Column names and types match the conventions
// the Better Auth Drizzle adapter expects (see
// https://www.better-auth.com/docs/adapters/drizzle). Snake-case on the DB
// side is handled by `drizzle.config.ts` (`casing: "snake_case"`).
//
// `user.email` always stores the address in its normalized form (lowercased
// and trimmed). The uniqueness constraint on `email` therefore enforces the
// "one account per normalized email" rule from the core-account-authentication
// capability — there is no second "normalized email" column, because any
// other copy would be redundant with this invariant.

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().default(""),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId)],
);

// Better Auth internal verification table. Kept for adapter compatibility even
// though the reduced bootstrap doesn't rely on Better Auth's built-in flow for
// email verification or password reset. Later changes may reuse it.
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// Application-owned token tables. The hashed material lives here, never in
// plaintext, so the reduced-bootstrap design constraint "stored only as
// hashes in Postgres" holds for both email verification and password reset
// flows.

export const emailVerificationToken = pgTable(
  "email_verification_token",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tokenHash] })],
);

export const passwordResetToken = pgTable(
  "password_reset_token",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tokenHash] })],
);

// Workspace foundation. Workspaces are the durable ownership boundary for
// transcript-adjacent product data; later capabilities (transcript
// processing, sharing, export, invitations) attach to `workspace.id` rather
// than to the user account directly. See
// `openspec/changes/add-workspace-foundation/design.md` for the decisions
// that shape this schema.

export const workspaceType = pgEnum("workspace_type", ["personal", "team"]);
export const workspaceRole = pgEnum("workspace_role", ["read_only", "member", "admin"]);

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    type: workspaceType("type").notNull(),
    name: text("name").notNull().default(""),
    slug: text("slug").notNull(),
    // `personal_owner_user_id` is set only on personal workspaces and points
    // to the single account that owns them. Team workspaces leave this
    // column null. The partial-unique index below enforces the
    // "one personal workspace per account" invariant at the database layer.
    personalOwnerUserId: text("personal_owner_user_id").references(() => user.id, { onDelete: "cascade" }),
    // Archive lifecycle state owned by `workspace-archival-lifecycle`:
    // - `archived_at` is the moment a team workspace entered the archived
    //   state. Null means the workspace is currently active.
    // - `scheduled_delete_at` is the moment the 60-day restoration window
    //   ends. Set together with `archived_at` and cleared on restore. The
    //   sweep job uses it to decide when an archived workspace becomes
    //   eligible for permanent deletion.
    // - `restored_at` is the most recent restore timestamp and is left in
    //   place across further lifecycle transitions. Downstream capabilities
    //   (public sharing in particular) read this to implement the
    //   "previously enabled public links stay inactive until fresh share
    //   management" rule: any share whose own `updatedAt` predates
    //   `restored_at` is treated as not yet re-enabled.
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    scheduledDeleteAt: timestamp("scheduled_delete_at", { withTimezone: true, mode: "date" }),
    restoredAt: timestamp("restored_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_slug_unique").on(table.slug),
    uniqueIndex("workspace_personal_owner_unique").on(table.personalOwnerUserId).where(sql`${table.personalOwnerUserId} IS NOT NULL`),
    index("workspace_scheduled_delete_idx").on(table.scheduledDeleteAt).where(sql`${table.scheduledDeleteAt} IS NOT NULL`),
  ],
);

export const workspaceMembership = pgTable(
  "workspace_membership",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull(),
    // `last_accessed_at` is convenience state used to resolve the default
    // authenticated landing workspace. It is never authoritative: explicit
    // route segments and the personal-workspace fallback take precedence.
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_membership_workspace_user_unique").on(table.workspaceId, table.userId),
    index("workspace_membership_user_idx").on(table.userId),
    index("workspace_membership_workspace_role_idx").on(table.workspaceId, table.role),
  ],
);

// Invitation lifecycle from `workspace-membership-and-invitations`.
//
// Each row is the durable record for one email/workspace/role target.
// The lifecycle transitions are:
//   pending → accepted   (acceptance consumes the current token hash)
//   pending → revoked    (admin revokes; row is retained for audit)
//   pending → expired    (past `expiresAt`; surfaced as "invalid link"
//                        until the sweep job or a resend replaces it)
//   pending → superseded (resend rotates the token; the prior token is
//                        invalidated immediately and the row's token
//                        hash is replaced, so consumption uses only the
//                        latest token)
//
// The partial-unique index on `(workspaceId, email)` where `status =
// 'pending'` keeps at most one active pending invitation per email per
// workspace. Resend mutates the existing row in place; revoke marks it
// terminal; acceptance stamps `consumed_at`; expiry is computed from
// `expires_at`.
export const workspaceInvitationStatus = pgEnum("workspace_invitation_status", ["pending", "accepted", "revoked", "expired", "superseded"]);

export const workspaceInvitation = pgTable(
  "workspace_invitation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // Stored lowercased + trimmed, matching `normalizeEmail` output so
    // lookups and the partial-unique index stay deterministic whether
    // the invitee has an account yet or not.
    email: text("email").notNull(),
    role: workspaceRole("role").notNull(),
    status: workspaceInvitationStatus("status").notNull().default("pending"),
    // `token_hash` is nullable because terminal statuses (accepted,
    // revoked, expired, superseded) MUST NOT keep a usable token even
    // if the row is retained for audit. Pending rows always have a
    // non-null hash; the partial-unique index below enforces that too.
    tokenHash: text("token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    // Filled when `status = 'accepted'` — points to the user account
    // that consumed the invitation. Kept nullable because pending and
    // other terminal rows have no consumer.
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    consumedByUserId: text("consumed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    // Admin that issued the invitation. Left nullable so the row
    // survives account removal of the inviter — the workspace+role
    // record stays intact even if the original admin closes their
    // account later.
    invitedByUserId: text("invited_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    // At most one pending invitation per (workspace, normalized email).
    // Terminal statuses are excluded from the index so an accepted or
    // revoked invitation never blocks a fresh invite to the same email.
    uniqueIndex("workspace_invitation_pending_unique").on(table.workspaceId, table.email).where(sql`${table.status} = 'pending'`),
    // Token lookup is always scoped to pending invitations; the partial
    // index keeps it lean and prevents leaked terminal-row tokens from
    // being reusable even as rows accumulate.
    uniqueIndex("workspace_invitation_token_hash_unique").on(table.tokenHash).where(sql`${table.status} = 'pending' AND ${table.tokenHash} IS NOT NULL`),
    index("workspace_invitation_workspace_status_idx").on(table.workspaceId, table.status),
    index("workspace_invitation_email_idx").on(table.email),
  ],
);

// Transcript + processing-job foundation owned by the
// `meeting-import-processing` and `transcript-data-retention` capabilities.
// See `openspec/changes/add-web-meeting-processing/design.md` for the
// decisions that shape this schema.
//
// Transcripts are durable workspace-owned product resources. Each
// accepted submission creates both a `transcript` row (the long-lived
// product resource) and a `processing_job` row (which tracks retries,
// stages, transient references, and the normalization-policy snapshot
// captured when the submission was accepted). Terminal transcripts
// keep only privacy-safe metadata plus canonical markdown content;
// raw notes, original filenames, local paths, and provider payloads
// are never persisted here.

export const transcriptStatus = pgEnum("transcript_status", [
  "queued",
  "preprocessing",
  "transcribing",
  "generating_recap",
  "generating_title",
  "finalizing",
  "retrying",
  "completed",
  "failed",
]);

export const mediaNormalizationPolicyValue = pgEnum("media_normalization_policy_value", ["optional", "required"]);

export const transcriptSourceMediaKind = pgEnum("transcript_source_media_kind", ["audio", "video"]);

export const transcriptFailureCode = pgEnum("transcript_failure_code", ["validation_failed", "processing_failed"]);

// `app_setting` is the database-backed configuration table. Today it
// carries only the media-normalization policy, but later changes can
// add rows with new keys without re-migrating the schema. Values are
// stored as JSON to keep the table agnostic to the setting's shape.
export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const transcript = pgTable(
  "transcript",
  {
    id: text("id").primaryKey(),
    // Workspace ownership follows the shared `workspace-scoped resource`
    // contract (see `workspaces/resource-contract.ts`). `workspaceId`
    // is the durable ownership boundary and only changes via explicit
    // transfer. `createdByUserId` captures creator attribution while
    // the account exists; later account-lifecycle work may null this
    // out without changing workspace ownership.
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    status: transcriptStatus("status").notNull().default("queued"),
    // Canonical durable content produced on successful completion.
    // Left empty until the worker reaches the finalizing stage.
    title: text("title").notNull().default(""),
    transcriptMarkdown: text("transcript_markdown").notNull().default(""),
    recapMarkdown: text("recap_markdown").notNull().default(""),
    // Privacy-safe metadata retained for later consultation and
    // management. `originalDurationSec` may be null when probing fails
    // before the transcript is published; `submittedWithNotes` records
    // only whether notes were supplied, not the notes themselves.
    sourceMediaKind: transcriptSourceMediaKind("source_media_kind").notNull(),
    originalDurationSec: real("original_duration_sec"),
    submittedWithNotes: boolean("submitted_with_notes").notNull().default(false),
    // Terminal failure metadata is intentionally generic so callers
    // can render a user-safe message without leaking raw provider
    // errors. `failureCode` classifies the failure family; the
    // `failureSummary` is a short user-facing string.
    failureCode: transcriptFailureCode("failure_code"),
    failureSummary: text("failure_summary"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("transcript_workspace_status_idx").on(table.workspaceId, table.status),
    index("transcript_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("transcript_created_by_idx").on(table.createdByUserId),
  ],
);

// `processing_job` owns all the transient execution state that should
// not pollute the durable transcript record. One job row per transcript
// follows the submission forward through retries; the partial-unique
// index below keeps that one-to-one relationship enforced at the
// database layer while still allowing future schema growth (e.g. a
// second "reprocess" attempt) to add another row behind a new status.
//
// `mediaInputKey` and `notesInputKey` are opaque references into the
// foundation-owned transient object store. Both are nullable because
// terminal cleanup deletes the underlying objects and clears the keys
// before the transcript row is marked `completed` or `failed`. The
// durable transcript record never stores these references.
export const processingJob = pgTable(
  "processing_job",
  {
    id: text("id").primaryKey(),
    transcriptId: text("transcript_id")
      .notNull()
      .references(() => transcript.id, { onDelete: "cascade" }),
    status: transcriptStatus("status").notNull().default("queued"),
    // Snapshot of the media-normalization policy that was active at
    // submission time. Later policy changes must not retroactively
    // apply to in-flight jobs.
    mediaNormalizationPolicySnapshot: mediaNormalizationPolicyValue("media_normalization_policy_snapshot").notNull(),
    // Which processing shape the accepted upload uses. Matches the
    // shared `MeetingInputKind` the worker-facing pipeline consumes.
    // `$type` narrows the row shape so worker glue can pass the value
    // to `processMeetingForWorker` without a runtime cast.
    mediaInputKind: text("media_input_kind").$type<"original" | "mp3-derivative">().notNull(),
    // Opaque transient-store keys. `upload_id` keeps a deterministic
    // reference for cleanup; `media_input_key` and `notes_input_key`
    // are cleared by the worker as part of terminal cleanup.
    uploadId: text("upload_id").notNull(),
    mediaInputKey: text("media_input_key"),
    mediaContentType: text("media_content_type"),
    notesInputKey: text("notes_input_key"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastFailureCode: transcriptFailureCode("last_failure_code"),
    lastFailureSummary: text("last_failure_summary"),
    transientCleanupCompletedAt: timestamp("transient_cleanup_completed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("processing_job_transcript_unique").on(table.transcriptId), index("processing_job_status_idx").on(table.status)],
);

export type UserRow = typeof user.$inferSelect;
export type InsertUserRow = typeof user.$inferInsert;
export type SessionRow = typeof session.$inferSelect;
export type AccountRow = typeof account.$inferSelect;
export type VerificationRow = typeof verification.$inferSelect;
export type EmailVerificationTokenRow = typeof emailVerificationToken.$inferSelect;
export type PasswordResetTokenRow = typeof passwordResetToken.$inferSelect;
export type WorkspaceRow = typeof workspace.$inferSelect;
export type InsertWorkspaceRow = typeof workspace.$inferInsert;
export type WorkspaceMembershipRow = typeof workspaceMembership.$inferSelect;
export type InsertWorkspaceMembershipRow = typeof workspaceMembership.$inferInsert;
export type WorkspaceInvitationRow = typeof workspaceInvitation.$inferSelect;
export type InsertWorkspaceInvitationRow = typeof workspaceInvitation.$inferInsert;
export type WorkspaceType = (typeof workspaceType.enumValues)[number];
export type WorkspaceRole = (typeof workspaceRole.enumValues)[number];
export type WorkspaceInvitationStatus = (typeof workspaceInvitationStatus.enumValues)[number];
export type AppSettingRow = typeof appSetting.$inferSelect;
export type InsertAppSettingRow = typeof appSetting.$inferInsert;
export type TranscriptRow = typeof transcript.$inferSelect;
export type InsertTranscriptRow = typeof transcript.$inferInsert;
export type ProcessingJobRow = typeof processingJob.$inferSelect;
export type InsertProcessingJobRow = typeof processingJob.$inferInsert;
export type TranscriptStatus = (typeof transcriptStatus.enumValues)[number];
export type MediaNormalizationPolicyValue = (typeof mediaNormalizationPolicyValue.enumValues)[number];
export type TranscriptSourceMediaKind = (typeof transcriptSourceMediaKind.enumValues)[number];
export type TranscriptFailureCode = (typeof transcriptFailureCode.enumValues)[number];
