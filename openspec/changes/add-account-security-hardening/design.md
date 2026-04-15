## Context

The foundation changes now cover primary sign-in methods, but they intentionally stop short of stronger account hardening and destructive lifecycle rules. Those concerns are tightly related to each other and are easier to reason about as a separate change than as incidental additions to every primary sign-in flow.

This change layers on:

- optional two-factor authentication
- backup-code recovery
- trusted devices
- recent-auth protections
- permanent account deletion

## Goals / Non-Goals

**Goals:**

- Add a strong second-factor option for users who want more protection.
- Preserve account recovery through backup codes and email OTP fallback.
- Keep trusted devices opt-in and time-bounded so second-factor UX stays usable.
- Require recent authentication before sensitive security changes or permanent deletion.
- Define permanent deletion semantics for credentials and owned-data cleanup hooks.

**Non-Goals:**

- New primary sign-in methods.
- Auth localization.
- Transcript-specific data deletion implementation details beyond the cleanup hook contract.

## Decisions

### Decision: Use Better Auth's `twoFactor` plugin for the second-factor foundation

This change uses Better Auth's `twoFactor` plugin as the base orchestration layer for:

- TOTP enrollment and verification
- email OTP delivery as an alternate second factor
- backup-code recovery
- trusted-device handling

That keeps protocol-heavy second-factor state transitions out of custom code while preserving application ownership of UX rules and recent-auth requirements.

### Decision: Two-factor authentication is opt-in and overlays every primary sign-in path

Users may enable 2FA after they already have an authenticated session. Once enabled, any supported primary sign-in path that reaches a valid first factor must pause on untrusted devices until the user completes a second-factor challenge.

This keeps the mental model simple: primary sign-in identifies the account, second factor unlocks full access.

### Decision: Support TOTP, email OTP, backup codes, and trusted devices together

The second-factor surface in this change includes:

- TOTP as the primary second factor
- email OTP as an alternate second factor
- backup codes for recovery
- trusted devices to reduce repeated prompts on known devices

Keeping the whole recovery story together prevents a half-finished 2FA rollout that could lock users out.

### Decision: Sensitive auth-management actions require recent authentication

Changing 2FA settings and permanently deleting an account require a fresh proof of identity even if the user still has a valid session. The exact re-auth mechanism may vary by primary sign-in method, but the security rule is the same: stale sessions are not enough for destructive account changes.

### Decision: Account deletion is permanent and privacy-oriented

Account deletion in this change:

- revokes all sessions
- removes password and provider credentials
- removes enrolled passkeys
- removes two-factor recovery material and trusted-device state
- enqueues cleanup of owned application data
- signs the user out immediately

This preserves the product's privacy posture while leaving transcript-specific deletion details to the later capabilities that own those datasets.

## Risks / Trade-offs

- [2FA flows can become a UX maze] -> Keep the challenge model consistent across primary sign-in paths and provide backup codes plus trusted devices.
- [Recent-auth rules can feel annoying if overused] -> Limit them to clearly sensitive actions such as 2FA management and permanent deletion.
- [Hard deletion can race with later background work] -> Require cleanup hooks to be idempotent and make later workers re-check account existence before durable writes.

## Migration Plan

1. Extend the auth schema with two-factor enrollment state, recovery material, and trusted-device data.
2. Enable the `twoFactor` plugin and integrate email OTP delivery.
3. Add second-factor challenge flows and trusted-device behavior.
4. Add recent-auth gates for 2FA management and permanent deletion.
5. Add regression coverage for both sign-in and destructive account-lifecycle behavior.

## Open Questions

None are blocking for this change. Auth localization remains a separate concern, and transcript-specific deletion behavior is defined by later transcript-focused capabilities.
