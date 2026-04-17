import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { clearCapturedEmails, getCapturedEmails } from "@/lib/server/email/memory";
import { getServerEnv } from "@/lib/server/env";

function ensureTestMode(): NextResponse | null {
  const env = getServerEnv();
  if (env.NODE_ENV === "production" || env.EMAIL_PROVIDER !== "memory") {
    return NextResponse.json({ ok: false, message: "Test endpoint is not available." }, { status: 404 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const blocked = ensureTestMode();
  if (blocked) return blocked;

  const to = request.nextUrl.searchParams.get("to") ?? undefined;
  const emails = getCapturedEmails(to);
  return NextResponse.json({ ok: true, emails });
}

export async function DELETE() {
  const blocked = ensureTestMode();
  if (blocked) return blocked;

  clearCapturedEmails();
  return NextResponse.json({ ok: true });
}
