## Why

The bootstrap and federated/passwordless auth changes establish how users sign in, but they intentionally leave out the extra protections and security-management behavior that would make those foundation changes too large.

This change adds the security overlays that harden an established account system: opt-in two-factor authentication, backup codes, trusted devices, and recent-auth protections for security-sensitive auth-management actions. Account closure or deactivation, including the 30-day self-service reactivation window, is handled separately by `add-account-closure-retention`.

## What Changes

- Add optional two-factor authentication with TOTP, email OTP, backup codes, and trusted devices.
- Require recent authentication for sensitive security-management actions such as managing two-factor settings or recovery material.
- Extend the auth email adapter to cover email OTP delivery for 2FA.
- Keep account closure or deactivation, including its 30-day self-service reactivation policy, out of this change and defer that lifecycle to `add-account-closure-retention`.

## Capabilities

### New Capabilities
- `account-security-hardening`: Two-factor authentication, backup-code recovery, trusted devices, and recent-auth protections for sensitive auth-management actions.

### Modified Capabilities
- `core-account-authentication`: Gains recent-auth and security-management hardening rules.
- `federated-and-passwordless-auth`: Gains second-factor enforcement after successful primary sign-in flows.

## Impact

- Postgres must store two-factor enrollment state, recovery material, and trusted-device state.
- The Better Auth integration grows to include the `twoFactor` plugin and second-factor enforcement after primary sign-in.
- AWS SES-backed auth email delivery expands to include email OTP messages.
- Account closure or deactivation semantics, including the 30-day self-service reactivation window, remain owned by `add-account-closure-retention`, keeping this change limited to auth hardening.
