## Context

The foundation changes now cover primary sign-in methods, but they intentionally stop short of stronger account hardening and related security-management rules. Those concerns are tightly related to each other and are easier to reason about as a separate change than as incidental additions to every primary sign-in flow.

This change layers on:

- optional two-factor authentication
- backup-code recovery
- trusted devices
- recent-auth protections

Account closure or deactivation is no longer part of this change. The V1 lifecycle contract, including the 30-day self-service reactivation window, now lives in `add-account-closure-retention` so this change can stay focused on auth hardening.

## Goals / Non-Goals

**Goals:**

- Add a strong second-factor option for users who want more protection.
- Preserve account recovery through backup codes and email OTP fallback.
- Keep trusted devices opt-in and time-bounded so second-factor UX stays usable.
- Require recent authentication before sensitive auth-management actions such as changing two-factor settings or recovery material.

**Non-Goals:**

- New primary sign-in methods.
- Auth localization.
- Account closure or deactivation semantics, including the 30-day self-service reactivation window, which are handled by `add-account-closure-retention`.
- Application-data cleanup or retention behavior during account closure.

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

Changing two-factor settings, regenerating recovery material, and other security-sensitive auth-management actions require a fresh proof of identity even if the user still has a valid session. The exact re-auth mechanism may vary by primary sign-in method, but the security rule is the same: stale sessions are not enough for sensitive auth-management changes.

### Decision: Account closure or deactivation is out of scope for this change

V1 account closure or deactivation is defined by `add-account-closure-retention`, not by this change. That includes the 30-day self-service reactivation window and the rule that reactivation uses fresh sign-in plus fresh second-factor verification when 2FA is enabled. This change may share recent-auth primitives with that lifecycle work later, but it does not define closure semantics, retained-state behavior, or cleanup hooks.

**Why this over alternatives**

- Over keeping closure in auth hardening: the workspace collaboration decisions made account lifecycle broader than account-security settings alone.
- Over leaving the old wording in place and hoping later implementation narrows it: the artifacts would continue to imply a V1 permanent-deletion contract that no longer applies.

## Risks / Trade-offs

- [2FA flows can become a UX maze] -> Keep the challenge model consistent across primary sign-in paths and provide backup codes plus trusted devices.
- [Recent-auth rules can feel annoying if overused] -> Limit them to clearly sensitive actions such as 2FA management and recovery-material changes.
- [Splitting account lifecycle out can leave boundary confusion] -> Make the scope boundary explicit and treat `add-account-closure-retention` as the source of truth for closure behavior.

## Migration Plan

1. Extend the auth schema with two-factor enrollment state, recovery material, trusted-device data, and any supporting recent-auth markers.
2. Enable the `twoFactor` plugin and integrate email OTP delivery.
3. Add second-factor challenge flows and trusted-device behavior.
4. Add recent-auth gates for managing two-factor settings and other security-sensitive auth-management actions in this change.
5. Add regression coverage for both sign-in and auth-management hardening behavior.

## Open Questions

None are blocking for this change. Auth localization remains a separate concern, and account closure behavior, including the 30-day self-service reactivation window, is defined by `add-account-closure-retention`.
