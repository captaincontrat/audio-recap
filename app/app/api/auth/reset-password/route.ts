import { badRequest, ensureSameOrigin, jsonResponse, readJsonBody } from "@/lib/auth/api-response";
import { completePasswordReset } from "@/lib/auth/password-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const body = await readJsonBody<{ token?: string; password?: string }>(request);
  if (!body || typeof body.token !== "string" || typeof body.password !== "string") {
    return badRequest("Token and password are required.");
  }

  const outcome = await completePasswordReset({ token: body.token, password: body.password });
  if (!outcome.ok) {
    const status = outcome.code === "user_missing" ? 400 : 400;
    return jsonResponse({ ok: false, code: outcome.code, message: outcome.message }, { status });
  }

  return jsonResponse({ ok: true, userId: outcome.userId });
}
