import "server-only";

import { randomUUID } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/server/db/client";
import { user, type WorkspaceRow, workspace, workspaceMembership } from "@/lib/server/db/schema";
import { generatePersonalWorkspaceSlug } from "./slug";

// Maximum number of slug generation attempts before giving up. Six bytes of
// entropy make collisions astronomically unlikely, but we still retry on the
// unique-index violation so a pathological collision doesn't surface as a
// sign-up failure.
const SLUG_RETRY_LIMIT = 5;

export type EnsurePersonalWorkspaceOptions = {
  userId: string;
  now?: Date;
};

// Provision the personal workspace for an account if it doesn't already
// exist. The personal workspace + its owner admin membership are created in
// a single database transaction so either both rows land or neither does,
// which means the unique-per-user invariant enforced by
// `workspace_personal_owner_unique` also covers the membership.
//
// The function is idempotent: callers (sign-up hook, backfill job, tests)
// can run it multiple times for the same `userId` without side effects.
export async function ensurePersonalWorkspace(options: EnsurePersonalWorkspaceOptions): Promise<WorkspaceRow> {
  const { userId } = options;
  const now = options.now ?? new Date();
  const db = getDb();

  const existing = await db.select().from(workspace).where(eq(workspace.personalOwnerUserId, userId)).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  // Drizzle's postgres-js driver exposes transactions via `.transaction`.
  // We retry slug generation in case two personal-workspace creations race
  // and pick the same short random slug.
  return db.transaction(async (tx) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < SLUG_RETRY_LIMIT; attempt += 1) {
      const workspaceId = randomUUID();
      const slug = generatePersonalWorkspaceSlug();
      try {
        const [inserted] = await tx
          .insert(workspace)
          .values({
            id: workspaceId,
            type: "personal",
            name: "Personal",
            slug,
            personalOwnerUserId: userId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        await tx.insert(workspaceMembership).values({
          id: randomUUID(),
          workspaceId,
          userId,
          role: "admin",
          createdAt: now,
          updatedAt: now,
        });
        return inserted;
      } catch (error) {
        lastError = error;
        if (!isUniqueSlugViolation(error)) {
          throw error;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Failed to create personal workspace");
  });
}

// Backfill personal workspaces for any account that predates this change.
// Intended to be called once from an operational command after the
// migration lands (`pnpm tsx scripts/backfill-personal-workspaces.ts`), or
// from targeted tests. Runs serially so a failure surfaces the specific
// `userId` that couldn't be migrated.
export async function backfillPersonalWorkspaces(options: { now?: Date } = {}): Promise<{ created: number; skipped: number }> {
  const now = options.now ?? new Date();
  const db = getDb();
  const rows = await db.select({ userId: user.id }).from(user).leftJoin(workspace, eq(workspace.personalOwnerUserId, user.id)).where(isNull(workspace.id));

  let created = 0;
  for (const row of rows) {
    await ensurePersonalWorkspace({ userId: row.userId, now });
    created += 1;
  }
  return { created, skipped: 0 };
}

function isUniqueSlugViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; constraint_name?: string };
  return err.code === "23505" && err.constraint_name === "workspace_slug_unique";
}
