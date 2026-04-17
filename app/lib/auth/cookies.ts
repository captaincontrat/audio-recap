export const SESSION_COOKIE_NAME = "summitdown.session_token";

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

export function sessionCookieOptions({ isProduction, maxAgeSeconds }: { isProduction: boolean; maxAgeSeconds: number }): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
