import { jsonResponse } from "@/lib/auth/api-response";
import { getSessionFromHeaders } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionFromHeaders(request.headers);
  if (!session) {
    return jsonResponse({ ok: true, session: null });
  }
  return jsonResponse({
    ok: true,
    session: {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified,
      expiresAt: session.session.expiresAt.toISOString(),
    },
  });
}
