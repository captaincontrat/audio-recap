import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class CsrfOriginMismatchError extends Error {
  readonly code = "csrf_origin_mismatch" as const;
  constructor(public readonly details: { origin: string | null; expected: string }) {
    super(`CSRF origin mismatch: received ${details.origin ?? "<null>"}, expected ${details.expected}`);
  }
}

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

export function assertSameOrigin({
  method,
  origin,
  referer,
  expectedOrigin,
}: {
  method: string;
  origin: string | null;
  referer: string | null;
  expectedOrigin: string;
}): void {
  if (isSafeMethod(method)) return;

  const candidate = origin ?? extractOrigin(referer);

  if (!candidate || candidate !== expectedOrigin) {
    throw new CsrfOriginMismatchError({ origin: candidate ?? origin, expected: expectedOrigin });
  }
}

function extractOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function fingerprintCsrfToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyCsrfToken(provided: string, expected: string): boolean {
  const providedHash = Buffer.from(fingerprintCsrfToken(provided), "hex");
  const expectedHash = Buffer.from(fingerprintCsrfToken(expected), "hex");
  return timingSafeEqual(providedHash, expectedHash);
}
