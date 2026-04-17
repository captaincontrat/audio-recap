import { badRequest, ensureSameOrigin, jsonResponse, readJsonBody } from "@/lib/auth/api-response";
import { signInWithPassword } from "@/lib/auth/signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const body = await readJsonBody<{ email?: string; password?: string }>(request);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return badRequest("Email and password are required.");
  }

  const outcome = await signInWithPassword({ email: body.email, password: body.password });
  if (!outcome.ok) {
    return jsonResponse({ ok: false, code: outcome.code, message: outcome.message }, { status: 401 });
  }

  return jsonResponse({ ok: true, userId: outcome.userId, emailVerified: outcome.emailVerified });
}
