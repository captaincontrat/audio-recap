import { sql } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
export type WorkspaceType = (typeof workspaceType.enumValues)[number];
export type WorkspaceRole = (typeof workspaceRole.enumValues)[number];
