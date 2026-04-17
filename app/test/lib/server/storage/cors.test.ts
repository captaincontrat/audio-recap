import { describe, expect, test } from "vitest";

import {
  buildTransientCorsRules,
  TRANSIENT_CORS_ALLOWED_HEADERS,
  TRANSIENT_CORS_EXPOSE_HEADERS,
  TRANSIENT_CORS_MAX_AGE_SECONDS,
} from "@/lib/server/storage/cors";

describe("transient bucket CORS", () => {
  test("produces a PUT-only rule with deduplicated origins", () => {
    const rules = buildTransientCorsRules(["http://localhost:3000", "http://localhost:3000/", "", "   ", "https://app.example.com"]);

    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      allowedMethods: ["PUT"],
      allowedOrigins: ["http://localhost:3000", "https://app.example.com"],
      allowedHeaders: [...TRANSIENT_CORS_ALLOWED_HEADERS],
      exposeHeaders: [...TRANSIENT_CORS_EXPOSE_HEADERS],
      maxAgeSeconds: TRANSIENT_CORS_MAX_AGE_SECONDS,
    });
  });

  test("rejects rules without any allowed origin", () => {
    expect(() => buildTransientCorsRules([])).toThrow(/at least one allowed origin/);
    expect(() => buildTransientCorsRules(["   "])).toThrow(/at least one allowed origin/);
  });
});
