import { badRequest, ensureSameOrigin, jsonResponse, readJsonBody, serverError } from "@/lib/auth/api-response";
import { signUpWithPassword } from "@/lib/auth/signup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = ensureSameOrigin(request);
  if (csrf) return csrf;

  const body = await readJsonBody<{
    email?: string;
    password?: string;
    name?: string;
  }>(request);

  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return badRequest("Email and password are required.");
  }

  const outcome = await signUpWithPassword({
    email: body.email,
    password: body.password,
    name: typeof body.name === "string" ? body.name : undefined,
  });

  if (!outcome.ok) {
    const status = outcome.code === "email_already_used" ? 409 : 400;
    return jsonResponse({ ok: false, code: outcome.code, message: outcome.message }, { status: outcome.code === "sign_up_failed" ? 500 : status });
  }

  return jsonResponse({
    ok: true,
    userId: outcome.userId,
    verificationExpiresAt: outcome.verificationExpiresAt.toISOString(),
  });
}

export function GET() {
  return serverError("Method not allowed.", "method_not_allowed");
}
