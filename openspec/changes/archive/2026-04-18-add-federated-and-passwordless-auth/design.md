## Context

`bootstrap-meeting-recap-web-platform` now defines only the core password-account foundation. The product brief still requires multiple alternative sign-in methods, but those flows do not need to live in the same change as the runtime and password bootstrap.

This change adds the remaining primary sign-in methods and the account-linking behavior that lets them coexist under one user record:

- Google OAuth
- Google One Tap
- magic-link sign-in
- passkey enrollment and passkey sign-in
- last-login-method hints

## Goals / Non-Goals

**Goals:**

- Add non-password primary sign-in methods without reopening the core identity model.
- Preserve one account per normalized email across password, Google, magic-link, and passkey usage.
- Keep passkeys additive to an existing account rather than introducing passkey-first onboarding.
- Improve sign-in wayfinding with last-login-method hints.

**Non-Goals:**

- Two-factor authentication, backup codes, trusted devices, or recent-auth protections.
- Account deletion flows.
- Auth localization.
- Transcript-processing or worker-storage behavior.

## Decisions

### Decision: Use Better Auth plugins for the alternative sign-in methods

This change layers these Better Auth plugins on top of the bootstrap foundation:

- `magic-link`
- `one-tap`
- `passkey`
- `last-login-method`

Using the plugin set keeps protocol-heavy sign-in behavior out of custom code while allowing the application to keep ownership of linking rules and UX boundaries.

### Decision: Preserve one account per normalized email across all sign-in methods

The bootstrap established the durable rule that one normalized email maps to one user account. This change extends that rule:

- Google sign-in with a new verified email creates a verified account.
- Google sign-in with an existing verified email links and signs into that existing account.
- Magic-link sign-in with a new email creates a verified account.
- Magic-link sign-in with an existing email signs into that account and satisfies email ownership verification.
- Passkeys attach only to an already authenticated existing account in this change.

This avoids duplicate transcript ownership and keeps future account recovery behavior understandable.

### Decision: Treat verified Google email as sufficient for automatic linking and activation

Automatic linking only happens when Google returns a verified email address. When that verified email matches an existing unverified password account, the system links the Google identity, marks the account verified, and signs the user in.

This keeps linking safe while preventing users from accidentally ending up with duplicate accounts.

### Decision: Magic links count as proof of email ownership

Magic-link sign-in is both a sign-in path and an email-ownership proof:

- a valid magic link for a new email creates a verified account
- a valid magic link for an existing unverified account marks that account verified
- expired or consumed links fail without signing the user in

The request step must remain neutral so the flow does not leak whether an email exists.

### Decision: Passkeys are additive and require an existing authenticated session for enrollment

Passkey enrollment in this change happens only after the user already has an authenticated account session. Returning users can later use those enrolled passkeys to sign in.

This keeps the passkey scope manageable and avoids combining account bootstrap, passkey enrollment, and passkey-first recovery into one change.

### Decision: Last-login-method hints remain client-side and non-authoritative

Last-login-method memory is only a UX hint:

- it can prioritize or label the sign-in UI
- it must not hide other methods
- it must not be required for authentication to work

No durable database field is required; a client-side cookie or equivalent local browser storage is sufficient.

## Risks / Trade-offs

- [Verified-email linking can become risky if upstream trust is too loose] -> Only link automatically when Google explicitly returns a verified email.
- [Multiple sign-in methods can create messy UX] -> Use last-login-method hints to improve wayfinding while keeping every method visible.
- [Passkeys can expand scope quickly] -> Keep enrollment session-bound and leave passkey-first onboarding out of scope.

## Migration Plan

1. Extend the bootstrap auth schema with Google identity links, magic-link tokens, and passkeys.
2. Enable the Better Auth plugin set for the alternative sign-in methods.
3. Implement the Google and magic-link linking rules on top of the existing one-account-per-email foundation.
4. Add passkey management and sign-in flows.
5. Add sign-in wayfinding hints and regression coverage.

## Open Questions

None are blocking for this change. Two-factor overlays, account deletion, and auth localization are handled by separate follow-up changes.
