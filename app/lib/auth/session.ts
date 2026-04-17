import "server-only";

import { getAuth } from "./instance";

export type SessionContext = {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    image?: string | null;
  };
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

// Request-scoped helper. Callers must supply the incoming request's headers so
// Better Auth can read the session cookie. The function returns `null` when
// there is no active session, matching the "visitor" audience in the spec.
export async function getSessionFromHeaders(headers: Headers): Promise<SessionContext | null> {
  const auth = getAuth();
  const result = await auth.api.getSession({ headers });
  if (!result) {
    return null;
  }
  // The Better Auth return shape is `{ user, session }`; we narrow the fields
  // we depend on and expose dates as `Date` so call-sites can compare them
  // directly.
  return {
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      emailVerified: result.user.emailVerified,
      createdAt: result.user.createdAt,
      updatedAt: result.user.updatedAt,
      image: result.user.image ?? null,
    },
    session: {
      id: result.session.id,
      userId: result.session.userId,
      token: result.session.token,
      expiresAt: result.session.expiresAt,
      createdAt: result.session.createdAt,
      updatedAt: result.session.updatedAt,
      ipAddress: result.session.ipAddress ?? null,
      userAgent: result.session.userAgent ?? null,
    },
  };
}

export class UnauthenticatedError extends Error {
  readonly code = "unauthenticated" as const;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class UnverifiedEmailError extends Error {
  readonly code = "email_unverified" as const;
  constructor(message = "Email address is not verified") {
    super(message);
    this.name = "UnverifiedEmailError";
  }
}

// Guard helper for protected server routes. Throws distinct errors so callers
// can respond with the right status (401 vs. redirect-to-verify flow).
export async function requireVerifiedSession(headers: Headers): Promise<SessionContext> {
  const context = await getSessionFromHeaders(headers);
  if (!context) {
    throw new UnauthenticatedError();
  }
  if (!context.user.emailVerified) {
    throw new UnverifiedEmailError();
  }
  return context;
}
