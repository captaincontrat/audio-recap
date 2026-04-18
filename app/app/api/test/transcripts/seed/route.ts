import "server-only";

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/server/db/client";
import {
  type TranscriptFailureCode,
  type TranscriptSourceMediaKind,
  type TranscriptStatus,
  transcript,
  user,
  type WorkspaceRole,
  workspace,
  workspaceMembership,
} from "@/lib/server/db/schema";
import { getServerEnv } from "@/lib/server/env";

// Test-only seeding endpoint that bypasses the normal processing
// pipeline so Playwright e2e flows can exercise the durable library and
// detail surfaces without running the real worker. Production requests
// return 404 so this never becomes an unintended public surface.
//
// Accepts:
//   { workspaceSlug, membership? (role override for the caller),
//     archiveWorkspace?, transcripts: [...] }
// Each transcript entry may override any durable column; defaults
// mirror a "completed" transcript with non-empty title and markdown so
// the library/detail surfaces render stable snapshots.

type SeedTranscriptInput = {
  id?: string;
  status?: TranscriptStatus;
  title?: string;
  transcriptMarkdown?: string;
  recapMarkdown?: string;
  sourceMediaKind?: TranscriptSourceMediaKind;
  originalDurationSec?: number | null;
  submittedWithNotes?: boolean;
  failureCode?: TranscriptFailureCode | null;
  failureSummary?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

type SeedRequestBody = {
  workspaceSlug: string;
  userEmail: string;
  membershipRole?: WorkspaceRole;
  archiveWorkspace?: boolean;
  transcripts: SeedTranscriptInput[];
};

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  if (env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "Test endpoint is not available." }, { status: 404 });
  }

  let body: SeedRequestBody;
  try {
    body = (await request.json()) as SeedRequestBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { workspaceSlug, userEmail, membershipRole, archiveWorkspace, transcripts } = body;
  if (!workspaceSlug || !userEmail) {
    return NextResponse.json({ ok: false, message: "workspaceSlug and userEmail are required" }, { status: 400 });
  }

  const db = getDb();
  const workspaceRows = await db.select().from(workspace).where(eq(workspace.slug, workspaceSlug)).limit(1);
  const workspaceRow = workspaceRows[0];
  if (!workspaceRow) {
    return NextResponse.json({ ok: false, message: "Workspace not found" }, { status: 404 });
  }

  const userRows = await db.select({ id: user.id }).from(user).where(eq(user.email, userEmail)).limit(1);
  const userRow = userRows[0];
  if (!userRow) {
    return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
  }

  if (membershipRole) {
    await db
      .update(workspaceMembership)
      .set({ role: membershipRole })
      .where(and(eq(workspaceMembership.workspaceId, workspaceRow.id), eq(workspaceMembership.userId, userRow.id)));
  }

  if (archiveWorkspace) {
    const now = new Date();
    const deleteAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    await db.update(workspace).set({ archivedAt: now, scheduledDeleteAt: deleteAt }).where(eq(workspace.id, workspaceRow.id));
  }

  const inserted: { id: string }[] = [];
  for (const input of transcripts ?? []) {
    const id = input.id ?? `test_transcript_${Math.random().toString(36).slice(2, 11)}`;
    const values = {
      id,
      workspaceId: workspaceRow.id,
      createdByUserId: userRow.id,
      status: input.status ?? ("completed" as TranscriptStatus),
      title: input.title ?? "Seeded transcript",
      transcriptMarkdown: input.transcriptMarkdown ?? "# Transcript\n\nSeeded content.",
      recapMarkdown: input.recapMarkdown ?? "## Recap\n\n- Seeded recap point",
      sourceMediaKind: input.sourceMediaKind ?? ("audio" as TranscriptSourceMediaKind),
      originalDurationSec: input.originalDurationSec ?? 600,
      submittedWithNotes: input.submittedWithNotes ?? false,
      failureCode: input.failureCode ?? null,
      failureSummary: input.failureSummary ?? null,
      createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
      updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date(),
      completedAt: input.completedAt === null ? null : input.completedAt ? new Date(input.completedAt) : new Date(),
    };
    await db.insert(transcript).values(values);
    inserted.push({ id });
  }

  return NextResponse.json({
    ok: true,
    workspaceId: workspaceRow.id,
    workspaceSlug,
    archived: archiveWorkspace === true,
    transcripts: inserted,
  });
}
