import "server-only";

import { getServerEnv } from "../server/env";
import { assertSameOrigin, CsrfOriginMismatchError } from "./csrf";

// Minimal JSON response builders shared by every auth route handler. They
// enforce a single shape so the browser forms and server always agree on the
// envelope, and they centralize the `content-type` + `cache-control` headers
// that the spec implicitly requires for POST responses.

const NO_CACHE_HEADERS: HeadersInit = {
  "cache-control": "no-store",
};

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...NO_CACHE_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

export function badRequest(message: string, code = "invalid_input"): Response {
  return jsonResponse({ ok: false, code, message }, { status: 400 });
}

export function unauthorized(message = "Authentication required.", code = "unauthenticated"): Response {
  return jsonResponse({ ok: false, code, message }, { status: 401 });
}

export function forbidden(message: string, code = "forbidden"): Response {
  return jsonResponse({ ok: false, code, message }, { status: 403 });
}

export function serverError(message = "Something went wrong.", code = "server_error"): Response {
  return jsonResponse({ ok: false, code, message }, { status: 500 });
}

export async function readJsonBody<T = unknown>(request: Request): Promise<T | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Wraps `assertSameOrigin` with the information a plain `Request` exposes so
// route handlers can do `if (!ensureSameOrigin(request)) return …` without
// reaching into headers themselves. Returns the error response when the
// origin doesn't match, `null` when the request is safe to proceed.
export function ensureSameOrigin(request: Request): Response | null {
  const env = getServerEnv();
  const expectedOrigin = new URL(env.BETTER_AUTH_URL).origin;
  try {
    assertSameOrigin({
      method: request.method,
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      expectedOrigin,
    });
    return null;
  } catch (error) {
    if (error instanceof CsrfOriginMismatchError) {
      return badRequest("Origin mismatch.", "origin_mismatch");
    }
    throw error;
  }
}
