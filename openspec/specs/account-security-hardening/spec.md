# account-security-hardening Specification

## Purpose

Defines the security overlays that sit on top of the `core-account-authentication` and `federated-and-passwordless-auth` foundations once an account already exists: opt-in two-factor authentication (TOTP, email OTP, backup codes), trusted-device behavior that bounds how often the second-factor challenge fires, and recent-auth protections that gate security-sensitive auth-management actions on a fresh authentication event. Account closure or deactivation, including the 30-day self-service reactivation window, is intentionally out of scope for this capability and is owned by `account-closure-retention`.

## Requirements

### Requirement: Users can enable optional two-factor authentication
The system SHALL allow an authenticated user to opt into two-factor authentication. The system SHALL support TOTP as a second factor, SHALL support email OTP as an alternate second factor, MUST generate backup codes for account recovery, and MAY remember trusted devices for a limited trust window. When a user with two-factor authentication enabled completes a primary sign-in flow, the system MUST require second-factor verification before granting full authenticated access unless the device is trusted.

#### Scenario: User enables TOTP-based 2FA
- **WHEN** an authenticated user enrolls in TOTP-based two-factor authentication and successfully verifies the initial TOTP code
- **THEN** the system marks two-factor authentication enabled and shows backup codes to the user

#### Scenario: User with 2FA enabled signs in and must verify a second factor
- **WHEN** a user with two-factor authentication enabled completes a primary sign-in flow on an untrusted device
- **THEN** the system pauses sign-in and requires TOTP or email-OTP verification before issuing full authenticated access

#### Scenario: User completes 2FA with a backup code
- **WHEN** a user submits a valid backup code during the second-factor step
- **THEN** the system completes sign-in and invalidates that backup code

#### Scenario: User trusts a device during 2FA verification
- **WHEN** a user successfully completes second-factor verification and chooses to trust the current device
- **THEN** the system remembers that device for the trust window and skips the second-factor prompt on later sign-ins during that window

### Requirement: Sensitive auth-management actions require recent authentication
The system SHALL require recent authentication before an authenticated user can perform security-sensitive auth-management actions. These actions MUST include two-factor management actions that materially change second-factor or recovery state, even if the user still has an otherwise valid session. Account closure or deactivation, including the 30-day self-service reactivation window, is out of scope for this capability and is specified by `add-account-closure-retention`.

#### Scenario: Recently authenticated user performs a sensitive auth-management action
- **WHEN** a recently authenticated user attempts a security-sensitive auth-management action that changes second-factor or recovery state
- **THEN** the system allows the action without requiring an additional re-authentication prompt

#### Scenario: User attempts a sensitive auth-management action without recent authentication
- **WHEN** an authenticated user tries to perform a security-sensitive auth-management action without a recent authentication check
- **THEN** the system requires re-authentication before allowing the action
