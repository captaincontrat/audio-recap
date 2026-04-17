export interface TransientCorsRule {
  allowedMethods: ("PUT" | "GET" | "HEAD")[];
  allowedOrigins: string[];
  allowedHeaders: string[];
  exposeHeaders: string[];
  maxAgeSeconds: number;
}

export const TRANSIENT_CORS_MAX_AGE_SECONDS = 3600;
export const TRANSIENT_CORS_ALLOWED_HEADERS = ["Content-Type", "Content-Length", "Content-MD5"] as const;
export const TRANSIENT_CORS_EXPOSE_HEADERS = ["ETag"] as const;

export function buildTransientCorsRules(allowedOrigins: string[]): TransientCorsRule[] {
  const uniqueOrigins = dedupeOrigins(allowedOrigins);

  if (uniqueOrigins.length === 0) {
    throw new Error("Transient bucket CORS requires at least one allowed origin.");
  }

  return [
    {
      allowedMethods: ["PUT"],
      allowedOrigins: uniqueOrigins,
      allowedHeaders: [...TRANSIENT_CORS_ALLOWED_HEADERS],
      exposeHeaders: [...TRANSIENT_CORS_EXPOSE_HEADERS],
      maxAgeSeconds: TRANSIENT_CORS_MAX_AGE_SECONDS,
    },
  ];
}

function dedupeOrigins(origins: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of origins) {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const normalized = trimmed.replace(/\/+$/, "");

    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}
