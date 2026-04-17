import "server-only";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/server/db/client";
import { user, workspace, workspaceMembership } from "@/lib/server/db/schema";
import { getServerEnv } from "@/lib/server/env";

// Read-only inspection endpoint used by Playwright e2e tests to verify
// workspace-foundation behavior (auto-provisioned personal workspace on
// sign-up, membership role resolution). Production requests return 404 so
// this never becomes an unintended public surface.
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  if (env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "Test endpoint is not available." }, { status: 404 });
  }

  const email = request.nextUrl.searchParams.get("email");
  const userIdParam = request.nextUrl.searchParams.get("userId");
  if (!email && !userIdParam) {
    return NextResponse.json({ ok: false, message: "Provide either `email` or `userId`." }, { status: 400 });
  }

  const db = getDb();
  let resolvedUserId = userIdParam;
  if (!resolvedUserId && email) {
    const matches = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    resolvedUserId = matches[0]?.id ?? null;
  }
  if (!resolvedUserId) {
    return NextResponse.json({ ok: true, userId: null, workspaces: [] });
  }

  const memberships = await db
    .select({
      membershipId: workspaceMembership.id,
      role: workspaceMembership.role,
      lastAccessedAt: workspaceMembership.lastAccessedAt,
      workspaceId: workspace.id,
      workspaceType: workspace.type,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      personalOwnerUserId: workspace.personalOwnerUserId,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, resolvedUserId));

  const personal = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.personalOwnerUserId, resolvedUserId), eq(workspace.type, "personal")));

  return NextResponse.json({
    ok: true,
    userId: resolvedUserId,
    workspaces: memberships.map((row) => ({
      membershipId: row.membershipId,
      role: row.role,
      lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
      workspaceId: row.workspaceId,
      workspaceType: row.workspaceType,
      workspaceSlug: row.workspaceSlug,
      workspaceName: row.workspaceName,
      isPersonalOwner: row.personalOwnerUserId === resolvedUserId,
    })),
    personalOwned: personal.length,
  });
}
