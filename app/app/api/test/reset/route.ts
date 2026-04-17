import "server-only";

import { sql as rawSql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db/client";
import { clearCapturedEmails } from "@/lib/server/email/memory";
import { getServerEnv } from "@/lib/server/env";

const TABLES = [
  "password_reset_token",
  "email_verification_token",
  "session",
  "account",
  "verification",
  "workspace_invitation",
  "workspace_membership",
  "workspace",
  '"user"',
] as const;

export async function POST() {
  const env = getServerEnv();
  if (env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "Test endpoint is not available." }, { status: 404 });
  }

  const db = getDb();
  for (const table of TABLES) {
    await db.execute(rawSql.raw(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`));
  }
  clearCapturedEmails();
  return NextResponse.json({ ok: true });
}
