## Context

The repository currently has two relevant pieces:

- `libs/audio-recap`, which already contains the useful meeting-processing pipeline: ffmpeg preprocessing and chunking, diarized transcription, transcript artifact construction, and GPT-5.4 recap generation.
- `app/`, which is only a Vite + React + shadcn shell and does not yet provide any backend runtime, persistent data model, or authentication system.

The product brief requires a web SaaS experience in `app/` with authenticated users, private ownership of future transcripts, and support for email/password plus Google sign-in. The repository already includes `docker-compose.yml` with Postgres and Redis services, which is a strong signal that the future web app should rely on durable relational state plus asynchronous background work instead of extending the current local CLI model.

This change is the platform bootstrap. It does not yet specify transcript upload, processing, sharing, or exports in full, but it must establish the architecture and account model those later capabilities will depend on.

## Goals / Non-Goals

**Goals:**

- Define the web platform topology for a browser app, authenticated API/BFF, and background worker.
- Assign clear roles to Postgres and Redis.
- Establish that the web product reuses importable pipeline code from `libs/audio-recap` instead of shelling out to the CLI.
- Define the account and session model for email/password and Google authentication.
- Define the expected lifecycle flows for sign-up, email verification, password reset, sign in, sign out, and account deletion.
- Keep the current CLI viable while the web product is built incrementally.

**Non-Goals:**

- Full transcript processing requirements, transcript library behavior, public sharing behavior, or export behavior. Those belong to later capability changes.
- Billing, subscriptions, invoicing, or payment-provider integration.
- Teams, shared workspaces, organization administration, or role-based admin consoles.
- API tokens or public developer APIs.
- Permanent archival of uploaded source audio/video.
- Rich account settings beyond the required authentication and account-deletion flows.

## Decisions

### Decision: Use a three-runtime web topology under `app/`

The product will use three cooperating runtimes, all belonging to the web app that lives in `app/`:

```text
Browser UI (`app/src`)
        |
        v
Web service / API-BFF (`app/server`)
        | \
        |  \__ Postgres (durable state)
        |
        \____ Redis (job queue / ephemeral coordination)
                    |
                    v
             Worker (`app/worker`)
                    |
                    v
          Shared pipeline modules (`libs/audio-recap`)
```

The browser UI remains the user-facing application. The web service serves the UI, owns the authenticated HTTP surface, and issues work to the worker. The worker handles long-running or retryable tasks such as future media preprocessing, transcription, and recap generation.

Keeping the browser app and API under the same `app/` product boundary preserves the brief's requirement that the web application live in `app/` while still allowing separate web and worker processes at deployment time.

**Why this over alternatives**

- Over a browser-only app with third-party serverless auth: this product needs durable ownership, queue-backed jobs, and private data, so it needs first-party server state anyway.
- Over splitting the repo immediately into separate frontend and backend packages: that adds packaging overhead before the product surface exists.
- Over a full framework rewrite now: the repo already has a React app shell, and this change is about architecture and contracts, not a framework migration.

### Decision: Postgres is the source of truth; Redis is ephemeral infrastructure

Postgres will store durable product state:

- users
- email addresses
- password credentials
- linked Google identities
- sessions
- email-verification tokens
- password-reset tokens
- future transcript ownership and metadata

Redis will hold only ephemeral coordination state:

- background job queues
- job leases and retries
- lightweight deduplication or locking
- transient rate-limit counters

Redis will not be the primary store for user identity, sessions, or future transcript records. Session revocation and account ownership need durable guarantees that survive Redis flushes or queue restarts.

**Why this over alternatives**

- Over Redis-backed sessions: Postgres provides stronger durability and simpler auditability for account lifecycle operations.
- Over skipping Redis until transcript processing exists: the worker boundary is part of the platform contract, and `docker-compose.yml` already prepares local development for it.

### Decision: Reuse shared pipeline code from `libs/audio-recap`, not the CLI process

The current CLI in `libs/audio-recap/src/cli.ts` is an orchestration wrapper around reusable units:

- audio preparation in `src/audio/ffmpeg.ts`
- transcription in `src/openai/transcribe.ts`
- transcript artifact assembly in `src/domain/transcript.ts`
- recap generation in `src/openai/summarize.ts`
- markdown rendering in `src/render/markdown.ts`

The web worker will import shared pipeline functions from `libs/audio-recap` directly. The CLI should evolve into a thin adapter that calls the same shared pipeline core.

The web platform must not invoke `pnpm process:meeting` or spawn the CLI as a subprocess for normal operation.

**Why this over alternatives**

- Over shelling out to the CLI: subprocess orchestration makes retries, observability, progress reporting, cleanup, and typed error handling much harder. It also bakes local filesystem assumptions into the web product.
- Over duplicating the pipeline inside `app/`: that would split the product's most valuable logic across two implementations and invite drift.

### Decision: Use server-managed sessions with secure cookies

Authentication will be session-based rather than token-based in the browser:

- the server creates opaque session identifiers
- the browser stores them in `HttpOnly` cookies
- cookies are `Secure` in production
- cookies use `SameSite=Lax`
- session records live in Postgres
- session revocation is server-side and immediate

This fits the product well because the browser app and API are same-origin, the app needs strong account deletion and session revocation semantics, and there is no requirement for public client APIs.

State-changing authenticated requests must use CSRF protection in addition to cookie settings.

**Why this over alternatives**

- Over JWTs stored in browser-accessible storage: opaque server sessions make revocation, logout, and account deletion simpler and safer.
- Over bearer tokens exposed to the SPA: there is no product need for portable client tokens, and they increase accidental leakage risk.

### Decision: Use one account per email with linkable credentials

The durable identity model is:

- one `user` record per human account
- one normalized primary email per user
- zero or one password credential
- zero or one Google identity link
- many revocable sessions

Rules:

- email addresses are globally unique across active accounts
- email/password sign-up creates an unverified account
- Google sign-in creates a verified account when the email is new
- Google sign-in links to an existing account when the email already exists
- a verified Google email satisfies email ownership verification for the linked account

This prevents duplicate libraries and avoids fragmenting a user's future transcript history across separate auth providers.

**Why this over alternatives**

- Over separate accounts per provider: that would create duplicate transcript ownership and confusing account recovery.
- Over manual provider linking later: matching by verified email is simpler and safer for a single-user SaaS.

### Decision: Verification and reset tokens are single-use, time-limited, and stored hashed

Email-verification tokens and password-reset tokens will be:

- generated server-side
- stored only as hashes in Postgres
- single-use
- time-limited
- invalidated on consumption

Password-reset completion revokes other active sessions. Verification and reset flows must not leak whether an email address exists except where the user is already authenticated.

**Why this over alternatives**

- Over reusable or long-lived tokens: shorter-lived single-use links reduce replay risk.
- Over storing plaintext tokens: hashed storage narrows the blast radius of database leaks.

### Decision: Account deletion is permanent and privacy-oriented

Account deletion will be a permanent action that:

- requires recent authentication
- revokes all sessions
- removes password and provider credentials
- enqueues deletion of owned future application data
- leaves no recoverable "trash" state for uploaded source media

This aligns with the brief's privacy posture and the explicit non-goal of permanent media archival. Later transcript-focused changes will define the exact owned data set, but the account platform must already assume deletion cascades are required.

**Why this over alternatives**

- Over indefinite soft-delete: a recoverable graveyard conflicts with the product's privacy direction and complicates future data-retention guarantees.

### Decision: Future source media remains transient infrastructure, not durable product content

Even though upload and processing behavior will be specified in a later change, this platform design reserves a clear boundary now:

- source audio/video and raw notes are transient inputs
- transcripts and recap markdown are the durable product resources
- permanent archival of source media is out of scope

The worker may use temporary filesystem or temporary object storage during processing, but later implementation must delete source media after the job reaches a terminal state.

**Why this over alternatives**

- Over durable media storage by default: the brief explicitly rejects long-term retention of source media, and keeping it would increase privacy and compliance exposure.

## Risks / Trade-offs

- [Three runtimes add operational complexity] -> Keep the browser app and API in one product boundary under `app/`, and use Redis only for the worker boundary that later transcript processing already needs.
- [Cookie sessions require CSRF discipline] -> Serve the browser app and API from the same origin, use `SameSite=Lax`, and require CSRF protection for state-changing requests.
- [Pipeline refactoring can slow the first web implementation] -> Preserve the CLI as a thin wrapper and refactor only the orchestration seams needed for shared imports.
- [Automatic Google linking can create account-takeover risk if email trust is weak] -> Only link when Google returns a verified email and the platform enforces one active account per email.
- [Hard-delete semantics can race with queued work] -> Make deletion jobs idempotent and require workers to re-check account existence before writing durable data.

## Migration Plan

1. Preserve the existing CLI workflow and keep `pnpm process:meeting` functional throughout the transition.
2. Add the web service and worker runtime skeletons under `app/` without yet replacing the CLI.
3. Add the Postgres schema for users, credentials, sessions, and token tables.
4. Refactor `libs/audio-recap` so the CLI and future worker both call shared pipeline functions.
5. Implement the authentication flows defined in the `account-authentication` spec.
6. Layer later changes on top of this platform for meeting import/processing, transcript management, sharing, and export.

Rollback strategy:

- keep the CLI untouched as the stable fallback path
- disable new web auth routes if needed
- stop the worker without affecting existing CLI use
- preserve durable auth data in Postgres until a follow-up migration explicitly removes it

## Open Questions

None are blocking for this change. Later changes will define transcript processing states, transcript metadata, public share payloads, and frontend export conversion details on top of this platform.
