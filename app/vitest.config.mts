import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws at import time to prevent the module from being
      // bundled into client code. Tests run in a unified jsdom environment so
      // we alias it to a noop to exercise the same module code paths.
      "server-only": new URL("./test/shims/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "test/**",
        // Server integration modules are covered by e2e and focused integration
        // tests in CI rather than jsdom unit tests. Their runtime surface
        // (network, DB, SES, Next.js route handlers) is intentionally thin and
        // provides no additional signal under jsdom coverage.
        "lib/server/db/client.ts",
        "lib/server/db/schema.ts",
        "lib/server/db/migrations/**",
        "lib/server/queue/**",
        "lib/server/email/ses.ts",
        "lib/server/email/factory.ts",
        "lib/auth/instance.ts",
        "lib/auth/client.ts",
        "lib/auth/session.ts",
        "lib/auth/accounts.ts",
        "lib/auth/token-store.ts",
        "lib/auth/signup.ts",
        "lib/auth/signin.ts",
        "lib/auth/signout.ts",
        "lib/auth/verification.ts",
        "lib/auth/password-reset.ts",
        "lib/auth/guards.ts",
        "lib/auth/api-response.ts",
        // Next.js pages and route handlers are covered by Playwright
        // end-to-end tests. They are thin view layers that wire imported
        // services to routes/forms; unit coverage would mostly mirror the
        // component library, not catch regressions.
        "app/**/page.tsx",
        "app/**/layout.tsx",
        "app/api/**",
        "components/features/**",
        "middleware.ts",
        "worker/**",
      ],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
