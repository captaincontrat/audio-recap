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
        "lib/server/storage/bootstrap.ts",
        "lib/server/storage/client.ts",
        "lib/server/storage/index.ts",
        "lib/server/storage/transient-store.ts",
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
        // Two-factor DB-touching modules. Pure constants in
        // `two-factor-config.ts` are unit-tested directly; these
        // modules wire recent-auth / OTP delivery through the
        // Drizzle client and the email adapter, which are exercised
        // end-to-end through the Playwright 2FA flows.
        "lib/auth/recent-auth.ts",
        "lib/auth/recent-auth-action.ts",
        "lib/auth/two-factor-email.ts",
        // Workspace modules that touch the Drizzle client. Pure decision
        // logic (eligibility, landing, slug, invariant simulation, resource
        // contract shape, archival state, archival eligibility, archival
        // gates, archival side-effect registry) lives in sibling modules
        // that are unit-tested directly; the DB-touching surface here is
        // exercised by e2e flows (see `test/auth-signup.e2e.ts` asserting
        // personal workspace creation after sign-up) plus the
        // `/api/test/workspaces` harness.
        "lib/server/workspaces/personal.ts",
        "lib/server/workspaces/memberships.ts",
        "lib/server/workspaces/membership-admin.ts",
        "lib/server/workspaces/invariant-guards.ts",
        "lib/server/workspaces/resolver.ts",
        "lib/server/workspaces/archival.ts",
        "lib/server/workspaces/invitations.ts",
        "lib/server/workspaces/invitation-archive-effect.ts",
        "lib/server/workspaces/bootstrap.ts",
        "lib/server/workspaces/index.ts",
        // `account-closure-retention` DB-touching modules. Pure decision
        // logic (closure state, closure eligibility, attribution, error
        // classes) lives in sibling modules that are unit-tested directly;
        // the orchestration here (DB writes, session revocation, permanent
        // deletion sweep) is exercised through e2e flows covering the
        // close / reactivate / expire pipeline.
        "lib/server/accounts/closure.ts",
        "lib/server/accounts/close-action.ts",
        "lib/server/accounts/reactivate-action.ts",
        "lib/server/accounts/index.ts",
        // Meeting-import-processing modules that touch the Drizzle
        // client, BullMQ queue, or S3 transient store. Pure decision
        // logic (submission decisions, retry policy, stage plan,
        // plan-token signing, status view projection, id generation,
        // error classes, HTTP status mapping) lives in sibling modules
        // that are unit-tested directly; the DB-/queue-/storage-touching
        // surface here is exercised through e2e tests covering the
        // submission → worker → status pipeline.
        "lib/server/meetings/acceptance.ts",
        "lib/server/meetings/normalization-policy.ts",
        "lib/server/meetings/status-read.ts",
        "lib/server/meetings/transcripts.ts",
        "lib/server/meetings/index.ts",
        // `private-transcript-library` DB-touching modules. The pure
        // decision logic (cursor codec, sort option parsing, query
        // option validation, projections, HTTP status mapping,
        // refusal error classes, displayTitle derivation) lives in
        // sibling modules that are unit-tested directly; the Drizzle
        // query + workspace-resolver wiring here is covered by the
        // Playwright e2e harness and the API route.
        "lib/server/transcripts/queries.ts",
        "lib/server/transcripts/library-read.ts",
        "lib/server/transcripts/detail-read.ts",
        "lib/server/transcripts/index.ts",
        // `add-public-transcript-sharing` DB-touching modules.
        // Pure decision logic (authorization gate, error classes,
        // HTTP status mapping, lookup validator) is unit-tested in
        // sibling modules; the Drizzle query + workspace-resolver
        // wiring here, including the service-layer orchestration
        // around enable/disable/rotate and the public resolver's
        // top-level DB lookup, is exercised through Playwright
        // e2e flows covering share management and the public
        // share surface.
        "lib/server/transcripts/sharing/queries.ts",
        "lib/server/transcripts/sharing/service.ts",
        "lib/server/transcripts/sharing/public-resolve.ts",
        "lib/server/transcripts/sharing/index.ts",
        // `transcript-edit-sessions` runtime modules touch Redis, the
        // Drizzle client, or the workspace-archive side-effect
        // registry. Pure decision logic (session-decisions,
        // http-status, errors, constants, ids, sanitize/buildUpdate
        // helpers in persistence) is unit-tested directly; the
        // Redis-/DB-/registry-touching surface is exercised through
        // the Playwright e2e harness and the API routes.
        "lib/server/transcripts/edit-sessions/locks.ts",
        "lib/server/transcripts/edit-sessions/persistence.ts",
        "lib/server/transcripts/edit-sessions/session-service.ts",
        "lib/server/transcripts/edit-sessions/archive-side-effect.ts",
        "lib/server/transcripts/edit-sessions/index.ts",
        "lib/server/storage/download.ts",
        // Client-side submission orchestration hits `fetch`, browser
        // upload, and the presigned URL flow end-to-end. It is covered
        // by the Playwright submission e2e rather than jsdom unit
        // coverage. The sibling `media-normalization.ts` abstraction is
        // also excluded because its current placeholder path only
        // reports `unavailable` — the branching lives behind the
        // ffmpeg.wasm integration that lands in a later change.
        "lib/client/meeting-submission.ts",
        "lib/client/media-normalization.ts",
        // Client-side edit-session network glue hits `fetch`, and the
        // `use-edit-session` hook orchestrates debounce timers,
        // autosave renewal, and same-tab resume on top of it. Both
        // layers are exercised end-to-end through the Playwright
        // harness; the pure decision logic, error classes, HTTP
        // status mapping, constants, and `sessionStorage` tab
        // identity helpers in the sibling modules are unit-tested
        // directly.
        "lib/client/edit-sessions/client.ts",
        "lib/client/edit-sessions/use-edit-session.ts",
        "lib/client/edit-sessions/index.ts",
        "instrumentation.ts",
        // Next.js pages and route handlers are covered by Playwright
        // end-to-end tests. They are thin view layers that wire imported
        // services to routes/forms; unit coverage would mostly mirror the
        // component library, not catch regressions.
        "app/**/page.tsx",
        "app/**/layout.tsx",
        "app/**/loading.tsx",
        "app/**/error.tsx",
        "app/**/not-found.tsx",
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
