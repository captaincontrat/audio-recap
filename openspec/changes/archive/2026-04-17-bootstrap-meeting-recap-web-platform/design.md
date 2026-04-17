## Context

The repository has two key starting points:

- `app/` already provides a Next.js + React frontend foundation with Biome, Vitest, and Playwright.
- `libs/audio-recap` already contains the local meeting-processing pipeline used by the CLI.

The original bootstrap tried to establish the entire web foundation plus every major authentication variant and some processing-coupled platform rules in one change. That made the change too large and mixed together concerns with different implementation dependencies.

This reduced bootstrap defines only the minimum shared platform and auth surface required by later web work:

- the persistent web/worker runtime boundary
- durable auth state in Postgres
- ephemeral coordination in Redis
- core email/password authentication
- verified-session enforcement for private routes

Everything else moves into smaller follow-up changes.

## Goals / Non-Goals

**Goals:**

- Define the runtime topology for the browser app, Next.js server runtime, and dedicated worker process under `app/`.
- Assign durable and ephemeral responsibilities to Postgres and Redis.
- Establish Better Auth as the core auth plumbing for password-account flows.
- Define the account/session model for password sign-up, verification, reset, sign-in, sign-out, and protected-route enforcement.
- Keep the CLI viable while the web product grows incrementally.

**Non-Goals:**

- Google sign-in, Google One Tap, magic-link sign-in, passkeys, last-login-method hints, or two-factor authentication.
- Auth localization for English/French/German/Spanish.
- Account deletion and recent-auth hardening flows.
- Concrete transient blob-storage behavior, presigned upload flows, or MinIO CORS details.
- Shared pipeline refactoring inside `libs/audio-recap`.
- Transcript processing, management, sharing, or export behavior.

## Decisions

### Decision: Keep the Next.js web runtime plus dedicated worker under `app/`

The platform baseline remains a browser client plus two server-side runtimes inside the web product:

```text
Browser UI (Next.js routes in `app/app`)
        |
        v
Next.js web runtime (`app/`)
        | \
        |  \__ Postgres (durable auth/application state via Drizzle)
        |
        \____ Redis (BullMQ jobs / ephemeral coordination)
                    |
                    v
             Worker (`app/worker`)
```

The browser UI is still the user-facing app. The Next.js runtime owns page rendering, authenticated route handlers, and request-time orchestration. The worker exists as a real platform boundary now so later processing changes can add background work without reopening the runtime topology decision.

**Why this over alternatives**

- Over a browser-only SPA plus a hand-rolled backend-for-frontend: Next.js already covers the same-origin app + server route shape this product needs.
- Over delaying the worker boundary until processing work begins: later changes already assume background work, so keeping the runtime split in the foundation avoids revisiting deployment topology.

### Decision: Use a Heroku-first deployment profile for the baseline

The default deployment profile for the reduced bootstrap is:

- a `web` process for the Next.js application
- a `worker` process for background job execution
- a `release` process for Drizzle migrations
- Heroku Postgres for durable relational state
- Heroku Redis for queue coordination

Concrete object storage is intentionally deferred to `add-web-meeting-processing`, which owns upload and transient-input behavior.

**Why this over alternatives**

- Over inventing a broader platform abstraction now: the operator already has a Heroku path, and this keeps the bootstrap small.
- Over bundling S3-compatible storage into this change: storage details are only actionable once meeting submission and worker input handling are specified.

### Decision: Postgres is the source of truth; Redis is ephemeral infrastructure

Postgres stores the durable account model introduced here:

- users
- normalized emails
- password credentials
- sessions
- email-verification tokens
- password-reset tokens

Redis stores only ephemeral coordination state:

- BullMQ queues
- leases and retries
- short-lived locking or deduplication data

Redis is not the durable store for identities or sessions. Session revocation, verification state, and password-reset semantics must survive queue restarts or Redis flushes.

**Why this over alternatives**

- Over Redis-backed sessions: password-account lifecycle rules need durable revocation and auditability.
- Over skipping Redis entirely: the worker/process boundary is part of the platform contract even before transcript processing is implemented.

### Decision: Use Drizzle for schema, migrations, and typed SQL access

Drizzle owns the relational schema and migration story for the web product:

- schema definitions stay close to application code
- migrations run explicitly in release/deploy workflows
- query code stays close to SQL concepts that fit auth/session tables well

**Why this over alternatives**

- Over Prisma: Drizzle adds less abstraction overhead for a schema that is mostly auth and platform state.
- Over hand-managed SQL only: that would add boilerplate right where the bootstrap is supposed to reduce it.

### Decision: Use BullMQ for Redis-backed background work

BullMQ provides the queue primitives for the web runtime and worker:

- enqueueing work from the Next.js runtime
- explicit job naming and future retry behavior
- shared Redis-client behavior across web and worker

This change does not yet define any transcript-processing jobs, but it keeps the job boundary real so later changes can layer on top of it.

**Why this over alternatives**

- Over custom Redis queue plumbing: BullMQ removes boilerplate around worker coordination and retries.
- Over a heavier workflow platform: this product does not need that complexity in the bootstrap.

### Decision: Use Pino for structured logs across web and worker

The Next.js runtime and `app/worker` will use `pino` for structured logs with shared context fields.

The reduced bootstrap keeps the logging baseline because auth bugs and worker orchestration issues become much easier to trace when both runtimes speak the same log format.

**Why this over alternatives**

- Over ad-hoc `console` logging: multi-runtime debugging gets messy quickly without structure.
- Over a heavier observability platform: `pino` is enough to establish good defaults without expanding scope.

### Decision: Use Better Auth for the core password-account foundation only

Better Auth will provide the core mechanics for:

- email/password sign-up and sign-in
- session issuance and validation
- verification and password-reset route/callback machinery

The application still owns product-specific rules:

- one active account per normalized email
- verification-pending versus fully verified access states
- Argon2id hashing for password credentials
- session revocation semantics on sign-out and password reset

Advanced auth plugins and flows are intentionally deferred to follow-up changes so the bootstrap does not have to carry the whole auth surface at once.

**Why this over alternatives**

- Over fully custom auth plumbing: Better Auth removes protocol boilerplate from the critical path.
- Over configuring every future auth plugin now: that couples this bootstrap to unrelated sign-in methods and makes the change too broad.

### Decision: Use AWS SES for outbound verification and reset email delivery

Production emails for this reduced bootstrap are limited to:

- email verification
- password reset

The delivery path should still live behind a small adapter so local development and CI can swap in a test sink later.

**Why this over alternatives**

- Over introducing a new mail provider: SES already fits the operator's stack.
- Over coupling auth logic directly to one transport API: a small adapter keeps higher-level auth flows testable.

### Decision: Keep Argon2id for password accounts

Better Auth defaults to `scrypt`, but the password-account foundation in this project continues to require Argon2id hashes.

That means the Better Auth password flow must provide custom hashing and verification functions so the stored credential material matches the security requirement in the spec.

**Why this over alternatives**

- Over silently changing the requirement to match a library default: the project already calls for Argon2id.
- Over storing or comparing passwords directly: password credentials must remain safely hashed if the database leaks.

### Decision: Use server-managed sessions with secure cookies

Authentication remains session-based:

- the server creates opaque session identifiers
- the browser stores them in `HttpOnly` cookies
- cookies are `Secure` in production
- cookies use `SameSite=Lax`
- session records live in Postgres
- revocation is server-side and immediate

State-changing authenticated requests require CSRF protection in addition to cookie settings.

**Why this over alternatives**

- Over browser-accessible bearer tokens: the product is same-origin and benefits more from revocable server sessions than from portable tokens.
- Over JWT-heavy browser auth: logout, password reset, and protected-route semantics stay simpler with opaque server sessions.

### Decision: Keep the identity model to one account per normalized email

The durable identity model for this bootstrap is intentionally small:

- one `user` record per human account
- one normalized email per user
- zero or one password credential
- many revocable sessions

Rules:

- email addresses are globally unique across active accounts
- password sign-up creates an unverified account
- only verified accounts get full access to protected surfaces

Linked credentials from Google, magic links, and passkeys are handled by later changes, but the "one account per email" rule is established now so those later flows have a stable identity contract to build on.

### Decision: Verification and reset tokens are single-use, time-limited, and stored hashed

Email-verification and password-reset tokens will be:

- generated server-side
- stored only as hashes in Postgres
- single-use
- time-limited
- invalidated on consumption

Password-reset request flows must not leak whether an email exists. Completing a reset revokes the user's other active sessions.

**Why this over alternatives**

- Over reusable or long-lived links: single-use, time-limited tokens reduce replay risk.
- Over storing plaintext tokens: hashed storage narrows the blast radius of a database leak.

### Decision: Standardize auth UI and validation on the app's existing toolchain

The reduced bootstrap keeps the existing `app/` quality and form stack:

- Biome for linting and formatting
- Vitest for component and server-adjacent unit/integration coverage
- Playwright for end-to-end auth coverage
- React Hook Form for non-trivial browser forms
- Zod plus `@hookform/resolvers` for shared validation language

This keeps the core auth flows aligned with the toolchain already present in `app/` and avoids introducing extra frontend abstractions during bootstrap.

## Risks / Trade-offs

- [Three runtimes add operational complexity] -> Keep the browser app and API in one product boundary under `app/`, and use Redis only where the worker boundary actually needs it.
- [Cookie sessions require CSRF discipline] -> Keep the app same-origin, use `SameSite=Lax`, and require CSRF protection on state-changing requests.
- [Deferring advanced auth flows means more follow-up changes] -> That is intentional; the smaller changes are easier to implement correctly and keep in agent context.
- [Worker infrastructure exists before transcript-processing logic] -> Accept the mild upfront setup cost so later processing work can stay focused on processing rather than on reopening platform decisions.

## Migration Plan

1. Preserve the existing CLI workflow and keep `pnpm process:meeting` functional throughout the transition.
2. Extend the existing Next.js app with authenticated server surfaces and add the separate worker runtime under `app/`.
3. Add the Drizzle schema and migrations for users, password credentials, sessions, and verification/reset tokens.
4. Implement the `core-account-authentication` flows with Better Auth plus app-owned account rules.
5. Layer follow-up changes on top of this foundation for federated/passwordless auth, account hardening, localization, meeting processing, transcript management, sharing, and export.

Rollback strategy:

- keep the CLI untouched as the stable fallback path
- disable new web auth routes if needed
- stop the worker without affecting existing CLI use
- preserve durable auth data in Postgres until a follow-up migration explicitly removes it

## Open Questions

None are blocking for this reduced bootstrap. Later changes will define advanced auth methods, auth localization, account deletion, transient upload/storage behavior, and shared pipeline reuse on top of this foundation.
