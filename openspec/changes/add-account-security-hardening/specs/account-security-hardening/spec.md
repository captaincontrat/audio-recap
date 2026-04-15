## ADDED Requirements

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

### Requirement: Users can permanently delete their account
The system SHALL allow an authenticated user to permanently delete their account after recent authentication and explicit confirmation. Account deletion MUST revoke all sessions, delete password and Google credentials, remove enrolled passkeys and two-factor secrets or recovery material, and enqueue deletion of owned application data defined by later capabilities.

#### Scenario: Recently authenticated user confirms account deletion
- **WHEN** a recently authenticated user explicitly confirms permanent account deletion
- **THEN** the system deletes the account credentials, revokes all sessions, enqueues owned-data deletion, and signs the user out

#### Scenario: User attempts account deletion without recent authentication
- **WHEN** an authenticated user tries to delete the account without a recent authentication check
- **THEN** the system requires re-authentication before allowing permanent deletion
