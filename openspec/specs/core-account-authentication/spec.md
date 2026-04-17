# core-account-authentication Specification

## Purpose

Defines password-based identity and session management for individual users of the Summitdown web product: account creation, email verification, password reset, sign-in, sign-out, session lifecycle, and protected-route enforcement for authenticated verified users. This capability owns the "one active account per normalized email" rule and the single-use, time-limited, hashed token contract for verification and reset flows that later capabilities (meeting processing, transcript library, workspace membership, advanced auth methods) will build on.

## Requirements

### Requirement: Visitor can create a password account
The system SHALL allow a visitor to create an account with a unique email address and a password that is at least 12 characters long. The system MUST normalize email addresses before uniqueness checks, MUST store only an Argon2id password hash, and MUST create the account in an unverified state until email ownership is confirmed. After successful sign-up, the system SHALL create a verification-pending session and send a verification email.

#### Scenario: Successful sign-up with a new email
- **WHEN** a visitor submits an unused email address and a valid password
- **THEN** the system creates an unverified account, stores only the password hash, creates a verification-pending session, and sends a verification email

#### Scenario: Sign-up uses an email that already belongs to an account
- **WHEN** a visitor submits an email address that is already associated with an existing account
- **THEN** the system refuses to create a second account and instructs the visitor to sign in or use password recovery

### Requirement: Email ownership is verified before password-account activation
The system SHALL require email verification before a password-based account can access protected meeting-processing or transcript-library features. Verification links MUST be single-use and time-limited. The system SHALL allow an authenticated unverified user to request another verification email.

#### Scenario: Verification link succeeds
- **WHEN** an authenticated unverified user follows a valid verification link
- **THEN** the system marks the account as verified and grants normal authenticated access

#### Scenario: Verification link is expired or already consumed
- **WHEN** a user follows an expired or previously used verification link
- **THEN** the system refuses to activate the account and offers a way to send a new verification email

#### Scenario: Unverified account attempts to access protected application features
- **WHEN** an authenticated but unverified password account requests a protected application route or API operation
- **THEN** the system redirects the user to the verification flow instead of granting full application access

### Requirement: Verified users can sign in and sign out with server-managed sessions
The system SHALL authenticate email/password accounts with server-managed sessions persisted in Postgres and represented in the browser by secure, HTTP-only cookies. The system MUST return the same generic authentication failure message for unknown email addresses and incorrect passwords. The system SHALL revoke the active session when the user signs out.

#### Scenario: Verified user signs in successfully
- **WHEN** a verified user submits the correct email address and password
- **THEN** the system creates a new authenticated session and grants access to protected application features

#### Scenario: Visitor submits invalid credentials
- **WHEN** a visitor submits an unknown email address or an incorrect password
- **THEN** the system denies access without revealing which field was incorrect

#### Scenario: Authenticated user signs out
- **WHEN** an authenticated user chooses to sign out
- **THEN** the system revokes the current session and returns the browser to an unauthenticated state

### Requirement: Users can reset a forgotten password
The system SHALL allow a visitor to request a password reset for password-based accounts. The system MUST return the same response whether or not the submitted email address belongs to an eligible account. Password-reset links MUST be single-use and time-limited. Completing a password reset MUST replace the stored password hash, invalidate outstanding reset tokens, and revoke all other active sessions.

#### Scenario: Password-reset request is submitted
- **WHEN** a visitor submits an email address on the forgot-password form
- **THEN** the system returns a neutral response and sends a reset email only if an eligible password-based account exists

#### Scenario: Password reset completes successfully
- **WHEN** a user follows a valid reset link and submits a new valid password
- **THEN** the system updates the password hash, invalidates prior reset tokens, revokes the user's other active sessions, and allows future sign-in with the new password

#### Scenario: Password-reset link is expired or already consumed
- **WHEN** a user follows an expired or previously used reset link
- **THEN** the system refuses to change the password and offers a way to start a new reset request

### Requirement: Protected application surfaces require an authenticated verified account
The system SHALL require an active authenticated session for private application routes and API operations. The system SHALL distinguish between unauthenticated and unverified states: unauthenticated users MUST be sent to sign-in flows, while authenticated but unverified password accounts MUST be sent to email-verification flows. Public share URLs are outside the scope of this capability and MUST not rely on these authenticated-route rules.

#### Scenario: Unauthenticated browser requests a protected route
- **WHEN** a browser without an active session requests a protected application route
- **THEN** the system sends the user to the sign-in flow instead of rendering the protected route

#### Scenario: Authenticated but unverified password account calls a protected API
- **WHEN** an authenticated but unverified password account calls a protected API operation
- **THEN** the system denies the protected operation and directs the user to the verification flow

#### Scenario: Authenticated verified account requests a protected route
- **WHEN** an authenticated verified account requests a protected application route or API operation
- **THEN** the system allows the request to proceed
